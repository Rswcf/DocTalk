Reading prompt from stdin...
2026-08-03T21:32:31.002545Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/deploy/SKILL.md: missing YAML frontmatter delimited by ---
2026-08-03T21:32:31.002573Z ERROR codex_core::session::session: failed to load skill /Users/mayijie/Projects/Code/010_DocTalk/.agents/skills/codex-implement/SKILL.md: missing YAML frontmatter delimited by ---
OpenAI Codex v0.144.0
--------
workdir: /Users/mayijie/Projects/Code/010_DocTalk
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR]
reasoning effort: xhigh
reasoning summaries: none
session id: 019fc98a-e530-7b81-a26d-ee545cead5d0
--------
user
# Codex review — P1 hygiene batch (domain_mode gate + paywall coverage)

Security-adjacent batch: a paid-feature gating fix + paywall UX coverage. Try to BREAK the gate and find dead-ends. Range `ba8a141..HEAD` (v0.25.0 → now), excluding the glass-spec docs commit.

```
git log --oneline ba8a141..HEAD
git diff ba8a141..HEAD
```

## What shipped
1. **domain_mode backend gate** (b6da842 chat.py, ef7e798 extractions.py, 1fab067 cleanup): `domain_mode` ("legal"/"academic") was Plus-gated frontend-only; backend accepted it unconditionally → free/anon users got paid domain-rules prompt behavior. Now BOTH input entry points (the only two: `ChatRequest.domain_mode`→chat.py chat_stream, `CreateExtractionRequest.domain_mode`→extractions.py create_extraction) gate with 403 `{"error":"DOMAIN_MODE_REQUIRES_PLUS","required_plan":"plus"}` when `domain_mode is not None AND plan not in {plus,pro}`; omitted → untouched; plus/pro → applies. Continuation endpoint has no domain_mode field and never touches DOMAIN_RULES; chat_stream re-sources domain_mode per-message and CLEARS the persisted session value when omitted (no downgrade-replay vector); collection chat routes through the same gated endpoint.
2. **paywall coverage** (dc18eff docs, 4cd4c8a, 78f660b, 28c0977, 1a2dcc8): surfaced upgrade CTAs/PaywallModal at 5 dead-end limit sites — SHARE_LIMIT_REACHED (ChatPanel), DOCUMENT_LIMIT_REACHED (2 layout-translation paths), DOMAIN_MODE_REQUIRES_PLUS e2e on chat SSE (useChatStream trigger + errorCopy + PaywallModal case + deriveUpgradePlan) and REST extraction (ExtractionPanel). 6 i18n keys ×11.

## Internal review (APPROVED) already verified
Gate has no bypass under adversarial tracing (continuation replay + collection-chat both checked); `.openPaywall` flag removed from the 403 entry (was inert — zero consumers — but contradicted its own invariant: 403s use inline CTA, only 402/MODE_NOT_ALLOWED auto-modal); i18n ×11 parity; palette clean; `npm run build` + targeted pytest + ruff all pass at HEAD.

## Attack surfaces
(1) ANY residual path where a free/anon request gets domain-rules behavior — replay of a persisted value, a service param sourced pre-gate, an unlisted endpoint, the collection path, extraction retry. (2) Gate over-fire — can it block ordinary free chat/extraction with no domain_mode? (3) The `openPaywall` invariant (finding the internal reviewer flagged): confirm removing it is correct and no surface actually needed auto-modal for these 403s. (4) 403 vs 402: does the frontend paywall/CTA path fire on CODE not status on both chat-SSE and REST-extraction routes? (5) Any new dead-end (a surfaced CTA that doesn't route to billing) or injection via the ChatPanel markdown-link CTA. (6) i18n truth.

Evidence to audit (don't repeat): 786 backend pass (gate mutation-tested), build/tsc/lint clean, 403-not-intercepted verified on both paths.

Report: severity-ranked findings with file:line, overall verdict CONSENSUS-SHIP / REVISE / BLOCK.

codex
I’ll trace both backend entry points and persisted-session behavior end to end, then follow every surfaced frontend error code through CTA/modal routing and i18n. I’ll treat the prior passing tests as baseline evidence and focus on bypasses, over-gating, and UI dead-ends.
  → Read scoped rules and enumerate the review range/changed files
  • Trace backend domain_mode authorization, persistence, collection, and extraction retry paths
  • Trace frontend SSE/REST error-code handling, paywall routing, markdown CTA safety, and i18n
  • Run focused adversarial checks and produce a severity-ranked verdict
exec
/bin/zsh -lc "sed -n '1,240p' .claude/rules/backend.md && sed -n '1,280p' .claude/rules/frontend.md && git log --oneline --decorate ba8a141..HEAD && git diff --stat ba8a141..HEAD && git diff --name-only ba8a141..HEAD" in /Users/mayijie/Projects/Code/010_DocTalk
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
e499bc7 (HEAD -> main, origin/main, origin/HEAD) docs(review): P1 hygiene Codex request
1fab067 fix: drop stray openPaywall on DOMAIN_MODE_REQUIRES_PLUS, fix rule doc
116d963 docs(spec): Liquid Glass redesign — Counterpoint palette + Fraunces/Plex, marketing-first batching
1a2dcc8 feat: add DOMAIN_MODE_REQUIRES_PLUS upgrade path (chat + REST extraction)
28c0977 fix: surface DOCUMENT_LIMIT_REACHED upgrade CTA in layout-translation import
78f660b fix: surface DOCUMENT_LIMIT_REACHED upgrade CTA in layout-translation submit
4cd4c8a fix: surface SHARE_LIMIT_REACHED upgrade CTA in chat share errors
dc18eff docs: P1 paywall upgrade-path coverage audit
4105a87 docs(p1-hygiene): fill in the extractions.py commit hash in the report
ef7e798 fix(extractions): gate domain_mode as Plus+ (P1 hygiene, second entry point)
b6da842 fix(chat): backend-gate domain_mode as a Plus+ feature (P1 hygiene)
 .claude/rules/frontend.md                          |   2 +-
 .../2026-08-03-p1-hygiene-codex-request.md         |  22 +++
 .../2026-08-03-p1-hygiene-backend-report.md        |  70 +++++++++
 .../2026-08-03-p1-paywall-coverage-report.md       | 169 +++++++++++++++++++++
 backend/app/api/chat.py                            |  20 +++
 backend/app/api/extractions.py                     |  20 +++
 backend/tests/test_error_taxonomy.py               | 101 ++++++++++++
 backend/tests/test_extractions_api.py              |  68 +++++++++
 .../2026-08-03-liquid-glass-redesign-design.md     |  97 ++++++++++++
 .../d/[documentId]/DocumentReaderPageClient.tsx    |  21 ++-
 frontend/src/components/Chat/ChatArtifactCard.tsx  |  20 ++-
 frontend/src/components/Chat/ChatPanel.tsx         |   4 +-
 .../src/components/Extraction/ExtractionPanel.tsx  |   4 +-
 frontend/src/components/PaywallModal.tsx           |   9 ++
 frontend/src/i18n/locales/ar.json                  |   6 +
 frontend/src/i18n/locales/de.json                  |   6 +
 frontend/src/i18n/locales/en.json                  |   6 +
 frontend/src/i18n/locales/es.json                  |   6 +
 frontend/src/i18n/locales/fr.json                  |   6 +
 frontend/src/i18n/locales/hi.json                  |   6 +
 frontend/src/i18n/locales/it.json                  |   6 +
 frontend/src/i18n/locales/ja.json                  |   6 +
 frontend/src/i18n/locales/ko.json                  |   6 +
 frontend/src/i18n/locales/pt.json                  |   6 +
 frontend/src/i18n/locales/zh.json                  |   6 +
 frontend/src/lib/billingLinks.ts                   |   5 +-
 frontend/src/lib/errorCopy.ts                      |   6 +
 frontend/src/lib/useChatStream.ts                  |   1 +
 28 files changed, 691 insertions(+), 14 deletions(-)
.claude/rules/frontend.md
.collab/dialogue/2026-08-03-p1-hygiene-codex-request.md
.collab/reviews/2026-08-03-p1-hygiene-backend-report.md
.collab/reviews/2026-08-03-p1-paywall-coverage-report.md
backend/app/api/chat.py
backend/app/api/extractions.py
backend/tests/test_error_taxonomy.py
backend/tests/test_extractions_api.py
docs/superpowers/specs/2026-08-03-liquid-glass-redesign-design.md
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx
frontend/src/components/Chat/ChatArtifactCard.tsx
frontend/src/components/Chat/ChatPanel.tsx
frontend/src/components/Extraction/ExtractionPanel.tsx
frontend/src/components/PaywallModal.tsx
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
frontend/src/lib/billingLinks.ts
frontend/src/lib/errorCopy.ts
frontend/src/lib/useChatStream.ts

Scoped rules and changed-file inventory are complete; the glass-spec commit is isolated as 116d963 and will be excluded from review findings.
  ✓ Read scoped rules and enumerate the review range/changed files
  → Trace backend domain_mode authorization, persistence, collection, and extraction retry paths
  • Trace frontend SSE/REST error-code handling, paywall routing, markdown CTA safety, and i18n
  • Run focused adversarial checks and produce a severity-ranked verdict
exec
/bin/zsh -lc "git diff ba8a141..HEAD -- backend/app/api/chat.py backend/app/api/extractions.py backend/tests/test_error_taxonomy.py backend/tests/test_extractions_api.py && rg -n --hidden --glob '"'!frontend/node_modules/**'"' --glob '"'!backend/.venv/**'"' \"domain_mode|DOMAIN_RULES|DOMAIN_MODE_REQUIRES_PLUS|CreateExtractionRequest|ChatRequest|continue\" backend/app backend/tests" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/backend/app/api/chat.py b/backend/app/api/chat.py
index 761737b..c074e97 100644
--- a/backend/app/api/chat.py
+++ b/backend/app/api/chat.py
@@ -388,6 +388,26 @@ async def chat_stream(
             },
         )
 
+    # P1 hygiene (top-down review, 2026-08-01): domain_mode ("legal"/
+    # "academic") is marketed as a Plus+ feature — the frontend disables
+    # the selector for free users (DomainModeSelector.tsx: canUse = plan in
+    # {plus,pro}) — but the backend accepted it unconditionally, so any
+    # free (or anonymous) user could bypass the UI gate entirely with a raw
+    # POST {"domain_mode": "legal"} and get the paid prompt behavior.
+    # Checked here, before the rate-limit/credit work below, since it's a
+    # cheap deterministic authorization check independent of both.
+    if body.domain_mode is not None:
+        plan = (user.plan or "free").lower() if user is not None else "free"
+        if plan not in {"plus", "pro"}:
+            raise HTTPException(
+                status_code=403,
+                detail={
+                    "error": "DOMAIN_MODE_REQUIRES_PLUS",
+                    "message": "Legal/Academic domain mode requires a Plus or Pro plan",
+                    "required_plan": "plus",
+                },
+            )
+
     # Rate limit anonymous users
     if user is None:
         client_ip = get_client_ip(request)
diff --git a/backend/app/api/extractions.py b/backend/app/api/extractions.py
index d242663..c77242e 100644
--- a/backend/app/api/extractions.py
+++ b/backend/app/api/extractions.py
@@ -183,6 +183,26 @@ async def create_extraction(
             status_code=409,
             detail={"error": "DOCUMENT_NOT_READY", "message": "Document is not ready"},
         )
+
+    # P1 hygiene follow-up (2026-08-03): domain_mode ("legal"/"academic")
+    # is a Plus+ feature (see app/api/chat.py's chat_stream for the
+    # primary gate + rationale — the frontend disables the selector for
+    # free users, but the backend accepted it unconditionally). This is
+    # the SECOND entry point that accepted it with zero plan check — a
+    # free/anon user could POST it directly on an extraction job and get
+    # the paid domain-rules prompt behavior. Same gate, same error shape.
+    if body.domain_mode is not None:
+        plan = (user.plan or "free").lower() if user is not None else "free"
+        if plan not in {"plus", "pro"}:
+            raise HTTPException(
+                status_code=403,
+                detail={
+                    "error": "DOMAIN_MODE_REQUIRES_PLUS",
+                    "message": "Legal/Academic domain mode requires a Plus or Pro plan",
+                    "required_plan": "plus",
+                },
+            )
+
     try:
         template = get_template(body.template_key)
     except ValueError:
diff --git a/backend/tests/test_error_taxonomy.py b/backend/tests/test_error_taxonomy.py
index 62476ee..ee1c6a3 100644
--- a/backend/tests/test_error_taxonomy.py
+++ b/backend/tests/test_error_taxonomy.py
@@ -720,6 +720,107 @@ async def test_chat_free_pro_monthly_limit_reached(
     assert detail["required_plan"] == "plus"
 
 
+# -------------------------- domain_mode plan gate (P1 hygiene) --------------------------
+# domain_mode ("legal"/"academic") is marketed as a Plus+ feature
+# (frontend/src/components/Chat/DomainModeSelector.tsx: canUse = plan in
+# {plus,pro}) but the backend accepted it unconditionally — schemas/chat.py's
+# ChatRequest.domain_mode -> chat.py:468's chat_service.chat_stream() call,
+# with zero plan check in between. Any free (or anonymous) user could POST
+# {"domain_mode": "legal"} directly and get the paid prompt behavior.
+
+@pytest.mark.asyncio
+async def test_chat_domain_mode_requires_plus_for_free_plan(
+    client: AsyncClient,
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    user = _make_user(plan="free")
+    db = _make_db()
+    _override_dependencies(db, optional_user=user)
+    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug=None), document_id=uuid.uuid4())
+    monkeypatch.setattr(chat_api, "verify_session_access", AsyncMock(return_value=session))
+
+    response = await client.post(
+        f"/api/sessions/{uuid.uuid4()}/chat",
+        json={"message": "Hello", "domain_mode": "legal"},
+    )
+    detail = _assert_error(response, 403, "DOMAIN_MODE_REQUIRES_PLUS")
+    assert detail["required_plan"] == "plus"
+
+
+@pytest.mark.asyncio
+async def test_chat_domain_mode_requires_plus_for_anonymous(
+    client: AsyncClient,
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    db = _make_db()
+    _override_dependencies(db, optional_user=None)
+    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug=None), document_id=uuid.uuid4())
+    monkeypatch.setattr(chat_api, "verify_session_access", AsyncMock(return_value=session))
+
+    response = await client.post(
+        f"/api/sessions/{uuid.uuid4()}/chat",
+        json={"message": "Hello", "domain_mode": "academic"},
+    )
+    detail = _assert_error(response, 403, "DOMAIN_MODE_REQUIRES_PLUS")
+    assert detail["required_plan"] == "plus"
+
+
+@pytest.mark.asyncio
+async def test_chat_domain_mode_omitted_does_not_gate_free_plan(
+    client: AsyncClient,
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    """Regression guard: the new gate must be domain_mode-conditional, not a
+    blanket block on free-plan chat — a free user with NO domain_mode set
+    must reach the NEXT check in the pipeline (rate limiting here), never
+    the domain_mode 403."""
+    user = _make_user(plan="free")
+    db = _make_db()
+    _override_dependencies(db, optional_user=user)
+    session = SimpleNamespace(document=SimpleNamespace(status="ready", demo_slug=None), document_id=uuid.uuid4())
+    monkeypatch.setattr(chat_api, "verify_session_access", AsyncMock(return_value=session))
+    monkeypatch.setattr(chat_api.auth_chat_limiter, "is_allowed", AsyncMock(return_value=False))
+
+    response = await client.post(f"/api/sessions/{uuid.uuid4()}/chat", json={"message": "Hello"})
+    _assert_error(response, 429, "RATE_LIMITED")  # NOT the domain_mode gate
+
+
+@pytest.mark.asyncio
+async def test_chat_domain_mode_allowed_for_plus_plan(
+    client: AsyncClient,
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    """Positive proof the gate doesn't block paid users: a Plus-plan user
+    sending domain_mode reaches chat_service.chat_stream (mocked to a
+    trivial stream) and gets a normal 200, not the domain_mode 403."""
+    user = _make_user(plan="plus")
+    db = _make_db(commit=AsyncMock())
+    _override_dependencies(db, optional_user=user)
+    session = SimpleNamespace(
+        document=SimpleNamespace(status="ready", demo_slug=None), document_id=uuid.uuid4(), collection_id=None,
+    )
+    monkeypatch.setattr(chat_api, "verify_session_access", AsyncMock(return_value=session))
+    monkeypatch.setattr(chat_api.auth_chat_limiter, "is_allowed", AsyncMock(return_value=True))
+    monkeypatch.setattr(chat_api.credit_service, "get_estimated_cost", lambda _mode: 7)
+    monkeypatch.setattr(chat_api.credit_service, "get_user_credits", AsyncMock(return_value=1000))
+
+    async def _noop(*_args, **_kwargs):
+        return None
+
+    monkeypatch.setattr("app.services.credit_service.ensure_monthly_credits", _noop)
+
+    async def _fake_chat_stream(*_args, **_kwargs):
+        yield {"event": "done", "data": {}}
+
+    monkeypatch.setattr(chat_api.chat_service, "chat_stream", _fake_chat_stream)
+
+    response = await client.post(
+        f"/api/sessions/{uuid.uuid4()}/chat",
+        json={"message": "Hello", "domain_mode": "legal"},
+    )
+    assert response.status_code == 200
+
+
 @pytest.mark.asyncio
 async def test_chat_continue_continuation_limit(
     client: AsyncClient,
diff --git a/backend/tests/test_extractions_api.py b/backend/tests/test_extractions_api.py
index 9732597..7e5c961 100644
--- a/backend/tests/test_extractions_api.py
+++ b/backend/tests/test_extractions_api.py
@@ -128,6 +128,74 @@ async def test_create_extraction_requires_ready_document(client: AsyncClient) ->
     _assert_error(response, 409, "DOCUMENT_NOT_READY")
 
 
+# -------------------------- domain_mode plan gate (P1 hygiene follow-up) --------------------------
+# Same vulnerability as chat.py's chat_stream (see test_error_taxonomy.py's
+# domain_mode tests): domain_mode ("legal"/"academic") is a Plus+ feature,
+# but this SECOND entry point (extraction jobs) accepted it unconditionally
+# too. Same gate, same error shape, placed right after the 409
+# doc-not-ready check.
+
+@pytest.mark.asyncio
+async def test_create_extraction_domain_mode_requires_plus_for_free_plan(client: AsyncClient) -> None:
+    user = _make_user(plan="free")
+    doc = _make_doc(user)
+    db = _make_db(get=AsyncMock(return_value=doc))
+    _override_dependencies(db, user)
+
+    response = await client.post(
+        f"/api/documents/{doc.id}/extractions",
+        json={"template_key": "executive_summary", "domain_mode": "legal"},
+    )
+
+    detail = _assert_error(response, 403, "DOMAIN_MODE_REQUIRES_PLUS")
+    assert detail["required_plan"] == "plus"
+
+
+@pytest.mark.asyncio
+async def test_create_extraction_domain_mode_omitted_does_not_gate_free_plan(client: AsyncClient) -> None:
+    """Regression guard: domain_mode omitted must reach the NEXT check
+    (the free monthly extraction limit here), never the domain_mode 403 —
+    the gate is domain_mode-conditional, not a blanket block."""
+    user = _make_user(plan="free")
+    doc = _make_doc(user)
+    db = _make_db(
+        get=AsyncMock(return_value=doc),
+        scalar=AsyncMock(return_value=FREE_MONTHLY_EXTRACTION_LIMIT),
+    )
+    _override_dependencies(db, user)
+
+    response = await client.post(
+        f"/api/documents/{doc.id}/extractions",
+        json={"template_key": "executive_summary"},
+    )
+
+    _assert_error(response, 403, "EXTRACTION_LIMIT_REACHED")  # NOT the domain_mode gate
+
+
+@pytest.mark.asyncio
+async def test_create_extraction_domain_mode_allowed_for_plus_plan(
+    client: AsyncClient,
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    """Positive proof the gate doesn't block paid users: a Plus-plan user
+    with domain_mode set passes through to the NEXT check (credits here,
+    mirroring test_create_extraction_insufficient_credits_rolls_back's
+    shape) instead of the domain_mode 403."""
+    user = _make_user(plan="plus")
+    doc = _make_doc(user)
+    db = _make_db(get=AsyncMock(return_value=doc))
+    _override_dependencies(db, user)
+    monkeypatch.setattr(credit_service, "debit_credits", AsyncMock(return_value=None))
+    monkeypatch.setattr(credit_service, "get_user_credits", AsyncMock(return_value=12))
+
+    response = await client.post(
+        f"/api/documents/{doc.id}/extractions",
+        json={"template_key": "executive_summary", "domain_mode": "legal"},
+    )
+
+    _assert_error(response, 402, "INSUFFICIENT_CREDITS")  # NOT the domain_mode gate
+
+
 @pytest.mark.asyncio
 async def test_create_extraction_enforces_free_monthly_limit(client: AsyncClient) -> None:
     user = _make_user(plan="free")
backend/app/services/document_brief_service.py:200:            continue
backend/app/services/document_brief_service.py:251:            continue
backend/app/services/document_brief_service.py:259:            continue
backend/app/services/document_brief_service.py:262:            continue
backend/app/services/document_brief_service.py:293:            continue
backend/app/services/document_brief_service.py:369:                continue
backend/app/services/document_brief_service.py:372:                continue
backend/app/services/document_brief_service.py:423:                continue
backend/app/services/document_brief_service.py:426:                continue
backend/app/services/document_brief_service.py:512:                    continue
backend/app/services/document_brief_service.py:530:                continue
backend/app/services/document_brief_service.py:532:                continue
backend/app/services/document_brief_service.py:535:                continue
backend/app/services/document_brief_service.py:547:                continue
backend/app/services/document_brief_service.py:585:                continue
backend/app/services/document_brief_service.py:607:                    continue
backend/app/services/document_brief_service.py:622:                    continue
backend/app/services/document_brief_service.py:653:                    continue
backend/app/services/document_brief_service.py:669:                continue
backend/app/services/document_brief_service.py:710:                    continue
backend/app/services/document_brief_service.py:742:                    continue
backend/app/services/document_brief_service.py:860:                    continue
backend/app/services/document_brief_service.py:913:                continue
backend/app/services/document_brief_service.py:917:                continue
backend/app/services/document_brief_service.py:979:                continue
backend/app/services/document_brief_service.py:1090:                continue
backend/app/services/document_brief_service.py:1172:                continue
backend/app/services/document_brief_service.py:1197:                continue
backend/app/services/document_brief_service.py:1200:                continue
backend/app/services/document_brief_service.py:1345:            continue
backend/app/services/document_brief_service.py:1469:            continue
backend/app/services/document_brief_service.py:1508:            continue
backend/app/services/document_brief_service.py:1515:            continue
backend/app/services/document_brief_service.py:1518:            continue
backend/app/services/document_brief_service.py:1557:            continue
backend/app/services/document_brief_service.py:1791:                continue
backend/tests/test_chat_summary_routing.py:139:        domain_mode=None,
backend/tests/test_chat_summary_routing.py:222:        domain_mode=None,
backend/tests/test_chat_summary_routing.py:330:        domain_mode=None,
backend/app/services/chat_tool_executor.py:118:    domain_mode: str | None,
backend/app/services/chat_tool_executor.py:130:                en="You have used the free structured extraction allowance. Upgrade to continue creating cited deliverables.",
backend/app/services/chat_tool_executor.py:150:            "domain_mode": domain_mode,
backend/app/services/chat_tool_executor.py:416:        domain_mode: str | None,
backend/app/services/chat_tool_executor.py:473:                domain_mode=domain_mode,
backend/app/services/document_intelligence.py:173:            continue
backend/app/services/document_intelligence.py:197:            continue
backend/app/services/document_intelligence.py:209:                continue
backend/app/services/document_intelligence.py:244:            continue
backend/app/services/question_template_service.py:45:            continue
backend/app/services/question_template_service.py:82:            continue
backend/app/services/question_template_service.py:105:            continue
backend/app/services/question_template_service.py:187:                        continue
backend/tests/test_error_taxonomy.py:723:# -------------------------- domain_mode plan gate (P1 hygiene) --------------------------
backend/tests/test_error_taxonomy.py:724:# domain_mode ("legal"/"academic") is marketed as a Plus+ feature
backend/tests/test_error_taxonomy.py:727:# ChatRequest.domain_mode -> chat.py:468's chat_service.chat_stream() call,
backend/tests/test_error_taxonomy.py:729:# {"domain_mode": "legal"} directly and get the paid prompt behavior.
backend/tests/test_error_taxonomy.py:732:async def test_chat_domain_mode_requires_plus_for_free_plan(
backend/tests/test_error_taxonomy.py:744:        json={"message": "Hello", "domain_mode": "legal"},
backend/tests/test_error_taxonomy.py:746:    detail = _assert_error(response, 403, "DOMAIN_MODE_REQUIRES_PLUS")
backend/tests/test_error_taxonomy.py:751:async def test_chat_domain_mode_requires_plus_for_anonymous(
backend/tests/test_error_taxonomy.py:762:        json={"message": "Hello", "domain_mode": "academic"},
backend/tests/test_error_taxonomy.py:764:    detail = _assert_error(response, 403, "DOMAIN_MODE_REQUIRES_PLUS")
backend/tests/test_error_taxonomy.py:769:async def test_chat_domain_mode_omitted_does_not_gate_free_plan(
backend/tests/test_error_taxonomy.py:773:    """Regression guard: the new gate must be domain_mode-conditional, not a
backend/tests/test_error_taxonomy.py:774:    blanket block on free-plan chat — a free user with NO domain_mode set
backend/tests/test_error_taxonomy.py:776:    the domain_mode 403."""
backend/tests/test_error_taxonomy.py:785:    _assert_error(response, 429, "RATE_LIMITED")  # NOT the domain_mode gate
backend/tests/test_error_taxonomy.py:789:async def test_chat_domain_mode_allowed_for_plus_plan(
backend/tests/test_error_taxonomy.py:794:    sending domain_mode reaches chat_service.chat_stream (mocked to a
backend/tests/test_error_taxonomy.py:795:    trivial stream) and gets a normal 200, not the domain_mode 403."""
backend/tests/test_error_taxonomy.py:819:        json={"message": "Hello", "domain_mode": "legal"},
backend/tests/test_error_taxonomy.py:825:async def test_chat_continue_continuation_limit(
backend/tests/test_error_taxonomy.py:838:        f"/api/sessions/{uuid.uuid4()}/chat/continue",
backend/tests/test_error_taxonomy.py:865:        f"/api/sessions/{uuid.uuid4()}/chat/continue",
backend/app/services/claim_verifier_service.py:130:            continue
backend/app/services/claim_verifier_service.py:132:            continue
backend/app/services/claim_verifier_service.py:134:            continue
backend/app/services/claim_verifier_service.py:204:                continue
backend/app/services/claim_verifier_service.py:208:                continue
backend/app/services/claim_verifier_service.py:211:                continue
backend/app/services/text_normalizer.py:81:            continue
backend/app/services/text_normalizer.py:84:            continue
backend/app/services/text_normalizer.py:88:            continue
backend/app/services/text_normalizer.py:108:                continue
backend/app/services/text_normalizer.py:112:            continue
backend/app/services/text_normalizer.py:114:            continue
backend/app/services/summary_service.py:139:            continue
backend/app/services/summary_service.py:143:            continue
backend/app/services/summary_service.py:168:            continue
backend/app/services/summary_service.py:175:            continue
backend/app/services/summary_service.py:207:            continue
backend/app/services/summary_service.py:219:            continue
backend/tests/test_chat_corrective_retrieval.py:234:        domain_mode=None,
backend/app/services/export_service.py:41:            continue
backend/app/services/export_service.py:44:                continue
backend/app/services/demo_seed.py:87:            continue
backend/app/services/demo_seed.py:94:                continue  # object present — nothing to do
backend/app/services/demo_seed.py:104:                continue
backend/app/services/demo_seed.py:139:            continue
backend/app/services/demo_seed.py:194:                            continue
backend/app/services/demo_seed.py:199:                        continue
backend/app/services/demo_seed.py:207:                        continue
backend/app/services/demo_seed.py:213:                    continue
backend/app/services/query_router.py:157:            continue
backend/app/services/query_router.py:161:            continue
backend/app/services/query_router.py:228:        domain_mode: str | None = None,
backend/app/services/query_router.py:347:        if domain_mode in {"legal", "academic"} and QueryIntent.EXISTENCE_CHECK in intents:
backend/tests/test_chat_tool_executor.py:64:        domain_mode=None,
backend/tests/test_chat_tool_executor.py:108:        domain_mode=None,
backend/tests/test_chat_tool_executor.py:134:        domain_mode=None,
backend/app/services/parse_service.py:164:                    continue
backend/app/services/parse_service.py:167:                    continue
backend/app/services/parse_service.py:192:                    continue
backend/app/services/parse_service.py:309:                        continue
backend/app/services/parse_service.py:312:                        continue
backend/app/services/parse_service.py:375:                            continue
backend/app/services/parse_service.py:378:                            continue
backend/app/services/parse_service.py:401:                    # Skip this page but continue with the rest
backend/app/services/parse_service.py:402:                    continue
backend/app/services/parse_service.py:448:                continue
backend/app/services/parse_service.py:450:                continue
backend/app/services/parse_service.py:497:                continue
backend/app/services/parse_service.py:503:                    continue
backend/app/services/parse_service.py:663:                continue
backend/app/services/parse_service.py:799:                continue
backend/app/services/parse_service.py:802:                continue
backend/app/services/parse_service.py:852:                    continue
backend/app/services/parse_service.py:872:                continue
backend/app/services/parse_service.py:876:                continue
backend/app/services/parse_service.py:898:                continue
backend/app/services/parse_service.py:943:                continue
backend/app/services/parse_service.py:947:                    continue
backend/app/services/parse_service.py:1009:                    continue
backend/app/services/document_diff_service.py:60:            continue
backend/app/services/document_diff_service.py:91:            continue
backend/app/services/document_diff_service.py:101:                continue
backend/app/services/document_diff_service.py:225:            continue
backend/app/services/document_diff_service.py:274:            continue
backend/app/services/document_diff_service.py:292:            continue
backend/app/services/document_diff_service.py:310:            continue
backend/app/services/document_diff_service.py:315:                continue
backend/app/services/corrective_retrieval_service.py:39:                continue
backend/app/services/corrective_retrieval_service.py:129:                continue
backend/app/services/citation_quote_service.py:68:            continue
backend/app/services/citation_quote_service.py:97:            continue
backend/app/services/citation_quote_service.py:99:            continue
backend/app/services/citation_quote_service.py:101:            continue  # tables / summaries have no clean prose sentence (H8)
backend/app/services/citation_quote_service.py:103:            continue
backend/app/services/citation_quote_service.py:147:            continue
backend/app/services/retrieval_service.py:87:            continue
backend/app/services/retrieval_service.py:135:            continue
backend/app/services/retrieval_service.py:171:            continue
backend/app/services/retrieval_service.py:174:            continue
backend/app/services/retrieval_service.py:259:                continue
backend/app/services/retrieval_service.py:276:                continue
backend/app/services/retrieval_service.py:286:                    continue
backend/app/services/retrieval_service.py:369:                continue
backend/app/services/retrieval_service.py:383:                continue
backend/app/services/query_planner_service.py:90:            continue
backend/app/services/query_planner_service.py:102:            continue
backend/app/services/query_planner_service.py:104:            continue
backend/app/services/query_planner_service.py:124:            continue
backend/app/services/table_service.py:77:            continue
backend/app/services/table_service.py:141:            continue
backend/app/services/table_service.py:174:                continue
backend/app/services/table_service.py:179:                continue
backend/app/services/table_service.py:185:                    continue
backend/app/services/table_service.py:362:def merge_continued_tables(tables: list[dict[str, Any]]) -> list[dict[str, Any]]:
backend/app/services/table_service.py:371:            continue
backend/app/services/table_service.py:452:                continue
backend/app/services/table_service.py:468:                continue
backend/app/services/table_service.py:476:                    continue
backend/app/services/table_service.py:733:    detected = merge_continued_tables(detected)
backend/app/services/rag_evaluator_service.py:111:            continue
backend/app/services/rag_evaluator_service.py:143:            continue
backend/tests/test_quote_intent_routing.py:348:        id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None,
backend/tests/test_quote_intent_routing.py:929:            id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None,
backend/tests/test_quote_intent_routing.py:1006:            id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None,
backend/tests/conftest.py:78:            continue
backend/app/services/quote_search_service.py:57:# ever reached, but the chat-routed path (ChatRequest.message has no length
backend/app/services/quote_search_service.py:225:                    continue
backend/app/services/quote_search_service.py:266:            continue
backend/app/services/quote_search_service.py:271:            continue
backend/app/services/quote_search_service.py:509:            continue
backend/app/services/quote_search_service.py:541:            continue
backend/app/services/quote_search_service.py:548:            continue
backend/app/services/quote_search_service.py:551:            continue
backend/app/services/quote_search_service.py:564:            continue
backend/app/services/quote_search_service.py:572:                continue
backend/app/services/quote_search_service.py:579:                continue
backend/app/services/extractors/docx_extractor.py:83:                continue
backend/app/services/extractors/docx_extractor.py:90:                continue
backend/app/services/extractors/xlsx_extractor.py:29:            continue
backend/app/services/extractors/text_extractor.py:49:                continue
backend/app/services/extractors/url_extractor.py:153:                    continue
backend/app/services/extractors/url_extractor.py:268:            continue
backend/app/services/extractors/url_extractor.py:271:            continue
backend/app/services/extractors/url_extractor.py:274:            continue
backend/app/services/extractors/url_extractor.py:329:            continue
backend/app/services/extractors/url_extractor.py:331:            continue
backend/tests/test_document_brief_service.py:252:                continue
backend/tests/test_document_brief_service.py:273:                    continue
backend/app/services/chat_service.py:368:            continue
backend/app/services/chat_service.py:370:            continue
backend/app/services/chat_service.py:418:            continue
backend/app/services/chat_service.py:455:            continue
backend/app/services/chat_service.py:695:            continue
backend/app/services/chat_service.py:712:            continue
backend/app/services/chat_service.py:1292:        domain_mode: Optional[str],
backend/app/services/chat_service.py:1312:                domain_mode=domain_mode,
backend/app/services/chat_service.py:1343:                    "can_continue": False,
backend/app/services/chat_service.py:1505:        domain_mode: Optional[str] = None,
backend/app/services/chat_service.py:1593:                domain_mode=domain_mode,
backend/app/services/chat_service.py:1604:            domain_mode=domain_mode,
backend/app/services/chat_service.py:1789:                        "can_continue": False,
backend/app/services/chat_service.py:2040:            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
backend/app/services/chat_service.py:2041:            # domain_mode=None means Default (no extra rules), string means apply rules
backend/app/services/chat_service.py:2042:            if domain_mode:
backend/app/services/chat_service.py:2043:                from app.core.model_profiles import DOMAIN_RULES
backend/app/services/chat_service.py:2044:                domain_rules = DOMAIN_RULES.get(domain_mode)
backend/app/services/chat_service.py:2047:                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
backend/app/services/chat_service.py:2056:            # Persist domain_mode to session (null clears, string sets)
backend/app/services/chat_service.py:2057:            if domain_mode != session_obj.domain_mode:
backend/app/services/chat_service.py:2058:                session_obj.domain_mode = domain_mode
backend/app/services/chat_service.py:2460:            can_continue = asst_msg.continuation_count < settings.MAX_CONTINUATIONS_PER_MESSAGE
backend/app/services/chat_service.py:2467:                "can_continue": can_continue and finish_reason == "length",
backend/app/services/chat_service.py:2532:    async def continue_stream(
backend/app/services/chat_service.py:2577:        # 2) Load assistant message to continue
backend/app/services/chat_service.py:2658:                        continue
backend/app/services/chat_service.py:2666:                            continue
backend/app/services/chat_service.py:3122:            can_continue = asst_msg.continuation_count < settings.MAX_CONTINUATIONS_PER_MESSAGE
backend/app/services/chat_service.py:3129:                "can_continue": can_continue and finish_reason == "length",
backend/tests/test_asst0_cancellation_baseline.py:257:                                  title=None, domain_mode=None)
backend/tests/test_asst0_cancellation_baseline.py:290:                                  title=None, domain_mode=None)
backend/tests/test_asst0_cancellation_baseline.py:314:async def test_continue_stream_midstream_cancel_settles_credits(monkeypatch):
backend/tests/test_asst0_cancellation_baseline.py:315:    """TC-R4: continue_stream has the SAME cancel-loss/no-refund bug (Codex r1 finding).
backend/tests/test_asst0_cancellation_baseline.py:345:    agen = chat_service_module.chat_service.continue_stream(
backend/tests/test_asst0_cancellation_baseline.py:353:        "asst=0 CREDIT LEAK (continue_stream): pre-debit not settled after mid-stream cancel."
backend/tests/test_asst0_cancellation_baseline.py:366:        domain_mode=None,
backend/tests/test_asst0_cancellation_baseline.py:417:async def test_continue_stream_setup_cancel_settles_via_cancel_path(monkeypatch):
backend/tests/test_asst0_cancellation_baseline.py:458:    agen = chat_service_module.chat_service.continue_stream(
backend/tests/test_asst0_cancellation_baseline.py:482:        domain_mode=None,
backend/tests/test_asst0_cancellation_baseline.py:537:async def test_continue_stream_llm_error_after_partial_answer_does_not_full_refund(monkeypatch):
backend/tests/test_asst0_cancellation_baseline.py:603:        async for event in chat_service_module.chat_service.continue_stream(
backend/tests/test_asst0_cancellation_baseline.py:627:        domain_mode=None,
backend/tests/test_asst0_cancellation_baseline.py:701:async def test_continue_stream_persist_failed_with_partial_answer_does_not_full_refund(monkeypatch):
backend/tests/test_asst0_cancellation_baseline.py:742:                                _FakeChunk("continued "),
backend/tests/test_asst0_cancellation_baseline.py:768:        async for event in chat_service_module.chat_service.continue_stream(
backend/tests/test_asst0_cancellation_baseline.py:792:        domain_mode=None,
backend/tests/test_asst0_cancellation_baseline.py:863:async def test_continue_stream_accounting_error_still_runs_fallback_settlement(monkeypatch):
backend/tests/test_asst0_cancellation_baseline.py:923:                                _FakeChunk("continued "),
backend/tests/test_asst0_cancellation_baseline.py:941:        async for event in chat_service_module.chat_service.continue_stream(
backend/app/services/document_element_service.py:144:            continue
backend/app/services/document_element_service.py:174:            continue
backend/tests/test_extractions_api.py:131:# -------------------------- domain_mode plan gate (P1 hygiene follow-up) --------------------------
backend/tests/test_extractions_api.py:133:# domain_mode tests): domain_mode ("legal"/"academic") is a Plus+ feature,
backend/tests/test_extractions_api.py:139:async def test_create_extraction_domain_mode_requires_plus_for_free_plan(client: AsyncClient) -> None:
backend/tests/test_extractions_api.py:147:        json={"template_key": "executive_summary", "domain_mode": "legal"},
backend/tests/test_extractions_api.py:150:    detail = _assert_error(response, 403, "DOMAIN_MODE_REQUIRES_PLUS")
backend/tests/test_extractions_api.py:155:async def test_create_extraction_domain_mode_omitted_does_not_gate_free_plan(client: AsyncClient) -> None:
backend/tests/test_extractions_api.py:156:    """Regression guard: domain_mode omitted must reach the NEXT check
backend/tests/test_extractions_api.py:157:    (the free monthly extraction limit here), never the domain_mode 403 —
backend/tests/test_extractions_api.py:158:    the gate is domain_mode-conditional, not a blanket block."""
backend/tests/test_extractions_api.py:172:    _assert_error(response, 403, "EXTRACTION_LIMIT_REACHED")  # NOT the domain_mode gate
backend/tests/test_extractions_api.py:176:async def test_create_extraction_domain_mode_allowed_for_plus_plan(
backend/tests/test_extractions_api.py:181:    with domain_mode set passes through to the NEXT check (credits here,
backend/tests/test_extractions_api.py:183:    shape) instead of the domain_mode 403."""
backend/tests/test_extractions_api.py:193:        json={"template_key": "executive_summary", "domain_mode": "legal"},
backend/tests/test_extractions_api.py:196:    _assert_error(response, 402, "INSUFFICIENT_CREDITS")  # NOT the domain_mode gate
backend/tests/test_quote_search_service.py:349:                    text="The quote lives in the page-1 portion of this chunk. Filler continues onto page two.",
backend/tests/test_quote_search_service.py:463:    ChatRequest.message has no such limit and strict chat routing passes the
backend/tests/test_chat_strict_quote_predebit.py:28:from app.schemas.chat import ChatRequest  # noqa: E402
backend/tests/test_chat_strict_quote_predebit.py:88:        body = ChatRequest(message="Give me a direct quote about the termination clause.", mode="quick")
backend/tests/test_chat_strict_quote_predebit.py:122:        body = ChatRequest(message="Give me a direct quote about the termination clause.", mode="quick")
backend/tests/test_chat_strict_quote_predebit.py:154:            id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None,
backend/tests/test_document_intelligence.py:142:def test_merge_continued_tables_drops_repeated_header() -> None:
backend/tests/test_document_intelligence.py:143:    merged = table_service.merge_continued_tables(
backend/tests/test_document_intelligence.py:167:def test_merge_continued_tables_does_not_merge_same_header_without_layout_signal() -> None:
backend/tests/test_document_intelligence.py:168:    merged = table_service.merge_continued_tables(
backend/app/services/extraction_service.py:203:                continue
backend/app/services/extraction_service.py:229:            continue
backend/app/services/extraction_service.py:239:                continue
backend/app/services/extraction_service.py:268:def _system_prompt(template: ExtractionTemplate, domain_mode: str | None) -> str:
backend/app/services/extraction_service.py:269:    domain = f"\nDomain mode: {domain_mode}." if domain_mode else ""
backend/app/services/extraction_service.py:290:def _call_llm(template: ExtractionTemplate, chunks: Sequence[tuple[Chunk, float]], locale: str | None, domain_mode: str | None) -> tuple[dict[str, Any], int, int]:
backend/app/services/extraction_service.py:293:        {"role": "system", "content": _system_prompt(template, domain_mode)},
backend/app/services/extraction_service.py:344:            continue
backend/app/services/extraction_service.py:408:                    continue
backend/app/services/extraction_service.py:541:            domain_mode = (job.input_scope or {}).get("domain_mode")
backend/app/services/extraction_service.py:546:            raw, prompt_tokens, completion_tokens = _call_llm(template, chunks, locale, domain_mode)
backend/tests/test_chat_setup_refunds.py:270:    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None)
backend/tests/test_chat_setup_refunds.py:315:async def test_continue_stream_refunds_predebit_when_setup_fails(
backend/tests/test_chat_setup_refunds.py:350:        async for event in chat_service_module.chat_service.continue_stream(
backend/tests/test_chat_setup_refunds.py:365:async def test_continue_stream_refunds_predebit_when_llm_client_unavailable(
backend/tests/test_chat_setup_refunds.py:409:        async for event in chat_service_module.chat_service.continue_stream(
backend/tests/test_chat_setup_refunds.py:432:    session_obj = SimpleNamespace(id=session_id, document_id=document_id, collection_id=None, title=None, domain_mode=None)
backend/tests/test_chat_setup_refunds.py:523:async def test_continue_stream_records_rag_verification_event(
backend/tests/test_chat_setup_refunds.py:585:        async for event in chat_service_module.chat_service.continue_stream(
backend/tests/test_chat_setup_refunds.py:604:async def test_continue_stream_reconciles_predebit_and_records_usage(
backend/tests/test_chat_setup_refunds.py:680:        async for event in chat_service_module.chat_service.continue_stream(
backend/tests/test_query_router.py:123:    route = query_router.route("Does this contract contain a non-compete clause?", domain_mode="legal")
backend/app/models/tables.py:218:    domain_mode: Mapped[Optional[str]] = mapped_column(sa.String(20), nullable=True)
backend/app/schemas/chat.py:10:class ChatRequest(BaseModel):
backend/app/schemas/chat.py:13:    domain_mode: Optional[Literal["legal", "academic"]] = None
backend/app/schemas/chat.py:56:    domain_mode: Optional[str] = None
backend/app/api/tables.py:308:            continue
backend/app/api/documents.py:530:                continue
backend/app/api/documents.py:533:                continue
backend/app/api/documents.py:536:                    continue
backend/app/api/documents.py:540:                    continue
backend/app/api/documents.py:542:                    continue
backend/app/api/documents.py:565:            continue
backend/app/api/documents.py:573:                    continue
backend/app/api/documents.py:577:                    continue
backend/app/api/documents.py:582:            continue
backend/app/api/documents.py:730:            continue
backend/app/api/admin.py:392:                continue
backend/app/api/admin.py:417:                continue
backend/app/api/admin.py:420:                continue
backend/app/api/admin.py:714:            continue
backend/app/api/admin.py:2184:    "continuation": "The answer continued a previous response and reused its existing citations.",
backend/app/api/search.py:29:            continue
backend/app/core/model_profiles.py:81:DOMAIN_RULES: dict[str, list[str]] = {
backend/app/api/collections.py:153:                continue
backend/app/api/collections.py:254:            continue
backend/app/api/collections.py:256:            continue
backend/app/api/collections.py:260:            continue
backend/app/api/collections.py:269:            continue
backend/app/api/collections.py:363:            ChatSession.domain_mode,
backend/app/api/collections.py:370:        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
backend/app/api/collections.py:382:                "domain_mode": row.domain_mode,
backend/app/api/extractions.py:46:class CreateExtractionRequest(BaseModel):
backend/app/api/extractions.py:49:    domain_mode: Literal["legal", "academic"] | None = None
backend/app/api/extractions.py:176:    body: CreateExtractionRequest,
backend/app/api/extractions.py:187:    # P1 hygiene follow-up (2026-08-03): domain_mode ("legal"/"academic")
backend/app/api/extractions.py:194:    if body.domain_mode is not None:
backend/app/api/extractions.py:200:                    "error": "DOMAIN_MODE_REQUIRES_PLUS",
backend/app/api/extractions.py:224:            "domain_mode": body.domain_mode,
backend/app/api/chat.py:35:    ChatRequest,
backend/app/api/chat.py:370:    body: ChatRequest,
backend/app/api/chat.py:391:    # P1 hygiene (top-down review, 2026-08-01): domain_mode ("legal"/
backend/app/api/chat.py:396:    # POST {"domain_mode": "legal"} and get the paid prompt behavior.
backend/app/api/chat.py:399:    if body.domain_mode is not None:
backend/app/api/chat.py:405:                    "error": "DOMAIN_MODE_REQUIRES_PLUS",
backend/app/api/chat.py:488:            domain_mode=body.domain_mode
backend/app/api/chat.py:507:@chat_router.post("/sessions/{session_id}/chat/continue")
backend/app/api/chat.py:508:async def chat_continue(
backend/app/api/chat.py:623:        async for ev in chat_service.continue_stream(
backend/app/api/chat.py:670:            ChatSession.domain_mode,
backend/app/api/chat.py:678:        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
backend/app/api/chat.py:690:            domain_mode=getattr(row, 'domain_mode', None),
backend/app/api/sharing.py:186:                    continue
backend/app/api/events.py:91:            continue
backend/app/api/billing.py:168:    Returns False when pending was cleared and checkout can continue.

codex
The first pass confirms the new checks sit before metering work and are conditional on an explicit non-null value. I’m now checking a subtler class of bypass: whether any downstream service reloads `ChatSession.domain_mode`, or retries an extraction job using stored `input_scope`, without going back through the two gates.
exec
/bin/zsh -lc "nl -ba backend/app/api/chat.py | sed -n '330,730p'
nl -ba backend/app/schemas/chat.py | sed -n '1,100p'
nl -ba backend/app/services/chat_service.py | sed -n '1260,1370p;1470,1630p;1990,2090p;2510,2710p'
nl -ba backend/app/services/chat_tool_executor.py | sed -n '90,175p;380,500p'
nl -ba backend/app/api/extractions.py | sed -n '1,310p'
nl -ba backend/app/services/extraction_service.py | sed -n '250,315p;500,580p'
rg -n --glob '*.py' '\\bdomain_mode\\b' backend/app | sort" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   330	    request: Request,
   331	    user: Optional[User] = Depends(get_current_user_optional),
   332	    db: AsyncSession = Depends(get_db_session),
   333	):
   334	    # Verify session access
   335	    session = await verify_session_access(session_id, user, db)
   336	    if not session:
   337	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   338	
   339	    rows = await db.execute(
   340	        select(Message).where(Message.session_id == session_id).order_by(asc(Message.created_at))
   341	    )
   342	    items = []
   343	    for m in rows.scalars():
   344	        items.append(
   345	            ChatMessageResponse(
   346	                id=m.id,
   347	                share_anchor=message_share_anchor(m.id),
   348	                role=m.role,
   349	                content=m.content,
   350	                citations=m.citations,
   351	                metadata_json=getattr(m, "metadata_json", {}) or {},
   352	                created_at=m.created_at,
   353	            )
   354	        )
   355	    # Anonymous demo sessions: surface the used count so the frontend can
   356	    # restore the counter when it reuses a stored session (see create-session).
   357	    demo_messages_used = None
   358	    if session.user_id is None and session.document and session.document.demo_slug:
   359	        client_ip = get_client_ip(request)
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
   511	    request: Request,
   512	    user: Optional[User] = Depends(get_current_user_optional),
   513	    db: AsyncSession = Depends(get_db_session),
   514	):
   515	    # Verify session access
   516	    session = await verify_session_access(session_id, user, db)
   517	    if not session:
   518	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   519	
   520	    # Block if document is not ready
   521	    if session.document and session.document.status != "ready":
   522	        raise HTTPException(
   523	            status_code=409,
   524	            detail={
   525	                "error": "DOCUMENT_PROCESSING",
   526	                "message": "Document is still being processed",
   527	                "status": session.document.status,
   528	            },
   529	        )
   530	
   531	    # Rate limit (same as chat_stream)
   532	    if user is None:
   533	        client_ip = get_client_ip(request)
   534	        if not await demo_chat_limiter.is_allowed(client_ip):
   535	            log_security_event("demo_rate_limit", ip=client_ip, session_id=session_id)
   536	            raise HTTPException(
   537	                status_code=429,
   538	                detail={
   539	                    "error": "RATE_LIMITED",
   540	                    "message": "Rate limit exceeded",
   541	                    "retry_after": 60,
   542	                },
   543	                headers={"Retry-After": "60"},
   544	            )
   545	    else:
   546	        if not await auth_chat_limiter.is_allowed(str(user.id)):
   547	            raise HTTPException(
   548	                status_code=429,
   549	                detail={
   550	                    "error": "RATE_LIMITED",
   551	                    "message": "Rate limit exceeded",
   552	                    "retry_after": 60,
   553	                },
   554	                headers={"Retry-After": "60"},
   555	            )
   556	
   557	    # Demo message limit (continuations count against it)
   558	    if user is None and session.document and session.document.demo_slug:
   559	        client_ip = get_client_ip(request)
   560	        allowed, _count = await demo_message_tracker.check_and_increment(
   561	            _demo_message_key(client_ip, session.document_id), DEMO_MESSAGE_LIMIT
   562	        )
   563	        if not allowed:
   564	            log_security_event("demo_message_limit", ip=client_ip, document_id=session.document_id)
   565	            raise HTTPException(
   566	                status_code=429,
   567	                detail={
   568	                    "error": "DEMO_MESSAGE_LIMIT_REACHED",
   569	                    "message": "Demo message limit reached",
   570	                    "limit": DEMO_MESSAGE_LIMIT,
   571	                },
   572	            )
   573	
   574	    # Check continuation limit
   575	    msg_id = uuid.UUID(body.message_id) if body.message_id else None
   576	    if msg_id:
   577	        from sqlalchemy import select as sa_select
   578	        msg_row = await db.execute(sa_select(Message).where(Message.id == msg_id))
   579	        msg = msg_row.scalar_one_or_none()
   580	    else:
   581	        msg_row = await db.execute(
   582	            select(Message)
   583	            .where(Message.session_id == session_id, Message.role == "assistant")
   584	            .order_by(Message.created_at.desc())
   585	            .limit(1)
   586	        )
   587	        msg = msg_row.scalar_one_or_none()
   588	
   589	    if not msg:
   590	        raise HTTPException(status_code=404, detail=MESSAGE_NOT_FOUND_DETAIL)
   591	
   592	    if msg.continuation_count >= settings.MAX_CONTINUATIONS_PER_MESSAGE:
   593	        raise HTTPException(
   594	            status_code=400,
   595	            detail={
   596	                "error": "CONTINUATION_LIMIT",
   597	                "message": "Maximum continuations reached",
   598	                "max": settings.MAX_CONTINUATIONS_PER_MESSAGE,
   599	            },
   600	        )
   601	
   602	    # Credit pre-check for authenticated users
   603	    if user is not None:
   604	        from app.services.credit_service import ensure_monthly_credits
   605	        await ensure_monthly_credits(db, user)
   606	        await db.commit()
   607	        effective_mode = body.mode or "balanced"
   608	        await enforce_free_mode_limits(db, user, effective_mode)
   609	        estimated_cost = credit_service.get_estimated_cost(effective_mode)
   610	        balance = await credit_service.get_user_credits(db, user.id)
   611	        if balance < estimated_cost:
   612	            raise HTTPException(
   613	                status_code=402,
   614	                detail={
   615	                    "error": "INSUFFICIENT_CREDITS",
   616	                    "message": "Insufficient credits",
   617	                    "required": estimated_cost,
   618	                    "balance": balance,
   619	                },
   620	            )
   621	
   622	    async def event_generator() -> AsyncGenerator[str, None]:
   623	        async for ev in chat_service.continue_stream(
   624	            session_id, msg_id, db, user=user, locale=body.locale, mode=body.mode
   625	        ):
   626	            line = f"event: {ev['event']}\n"
   627	            payload = json.dumps(ev.get("data", {}), ensure_ascii=False)
   628	            data_line = f"data: {payload}\n\n"
   629	            yield line + data_line
   630	
   631	    return StreamingResponse(
   632	        event_generator(),
   633	        media_type="text/event-stream",
   634	        headers={
   635	            "Cache-Control": "no-cache, no-transform",
   636	            "X-Accel-Buffering": "no",
   637	            "Connection": "keep-alive",
   638	        },
   639	    )
   640	
   641	
   642	@chat_router.get("/documents/{document_id}/sessions", response_model=SessionListResponse)
   643	async def list_sessions(
   644	    document_id: uuid.UUID,
   645	    limit: int = Query(10, ge=1, le=100),
   646	    offset: int = Query(0, ge=0),
   647	    user: Optional[User] = Depends(get_current_user_optional),
   648	    db: AsyncSession = Depends(get_db_session),
   649	):
   650	    # Verify document access
   651	    doc = await verify_document_access(document_id, user, db)
   652	    if not doc:
   653	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   654	
   655	    # Demo documents: enforce session ownership
   656	    if doc.demo_slug:
   657	        if user is None:
   658	            # Anonymous users never see previous sessions
   659	            return SessionListResponse(sessions=[])
   660	        # Authenticated users only see their own demo sessions (handled in query below)
   661	
   662	    last_activity = func.coalesce(
   663	        func.max(Message.created_at), ChatSession.created_at
   664	    ).label("last_activity_at")
   665	
   666	    stmt = (
   667	        select(
   668	            ChatSession.id,
   669	            ChatSession.title,
   670	            ChatSession.domain_mode,
   671	            ChatSession.created_at,
   672	            func.count(Message.id).label("message_count"),
   673	            last_activity,
   674	        )
   675	        .outerjoin(Message, Message.session_id == ChatSession.id)
   676	        .where(ChatSession.document_id == document_id)
   677	        .where(ChatSession.user_id == user.id if (doc.demo_slug and user) else True)
   678	        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
   679	        .order_by(desc(last_activity))
   680	        .limit(limit)
   681	        .offset(offset)
   682	    )
   683	    result = await db.execute(stmt)
   684	    rows = result.all()
   685	    sessions = [
   686	        SessionListItem(
   687	            session_id=row.id,
   688	            title=row.title,
   689	            message_count=row.message_count,
   690	            domain_mode=getattr(row, 'domain_mode', None),
   691	            created_at=row.created_at,
   692	            last_activity_at=row.last_activity_at,
   693	        )
   694	        for row in rows
   695	    ]
   696	    return SessionListResponse(sessions=sessions)
   697	
   698	
   699	@chat_router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
   700	async def delete_session(
   701	    session_id: uuid.UUID,
   702	    user: Optional[User] = Depends(get_current_user_optional),
   703	    db: AsyncSession = Depends(get_db_session),
   704	):
   705	    # Verify session access
   706	    session = await verify_session_access(session_id, user, db)
   707	    if not session:
   708	        raise HTTPException(status_code=404, detail=SESSION_NOT_FOUND_DETAIL)
   709	
   710	    await db.delete(session)
   711	    await db.commit()
   712	    return None  # 204
     1	from __future__ import annotations
     2	
     3	import uuid
     4	from datetime import datetime
     5	from typing import List, Literal, Optional
     6	
     7	from pydantic import BaseModel, Field
     8	
     9	
    10	class ChatRequest(BaseModel):
    11	    message: str
    12	    mode: Optional[Literal["quick", "balanced", "thorough"]] = None
    13	    domain_mode: Optional[Literal["legal", "academic"]] = None
    14	    locale: Optional[str] = None  # Frontend locale code (en/zh/es/fr/de)
    15	
    16	
    17	class ContinueRequest(BaseModel):
    18	    message_id: Optional[str] = None  # If absent, use most recent assistant message
    19	    mode: Optional[Literal["quick", "balanced", "thorough"]] = None
    20	    locale: Optional[str] = None
    21	
    22	
    23	class ChatMessageResponse(BaseModel):
    24	    id: uuid.UUID
    25	    share_anchor: str
    26	    role: str
    27	    content: str
    28	    citations: Optional[List[dict]] = None
    29	    metadata_json: dict = Field(default_factory=dict)
    30	    created_at: datetime
    31	
    32	    class Config:
    33	        from_attributes = True
    34	
    35	
    36	class SessionResponse(BaseModel):
    37	    session_id: uuid.UUID
    38	    document_id: uuid.UUID
    39	    title: Optional[str] = None
    40	    created_at: datetime
    41	
    42	
    43	class SessionCreateResponse(SessionResponse):
    44	    demo_messages_used: Optional[int] = None
    45	
    46	
    47	class SessionMessagesResponse(BaseModel):
    48	    messages: List[ChatMessageResponse]
    49	    demo_messages_used: Optional[int] = None
    50	
    51	
    52	class SessionListItem(BaseModel):
    53	    session_id: uuid.UUID
    54	    title: Optional[str] = None
    55	    message_count: int
    56	    domain_mode: Optional[str] = None
    57	    created_at: datetime
    58	    last_activity_at: datetime
    59	
    60	
    61	class SessionListResponse(BaseModel):
    62	    sessions: List[SessionListItem]
  1260	
  1261	# ---------------------------
  1262	# Chat Service
  1263	# ---------------------------
  1264	
  1265	
  1266	class ChatService:
  1267	    async def _persist_user_message_and_title(
  1268	        self,
  1269	        *,
  1270	        db: AsyncSession,
  1271	        session_id: uuid.UUID,
  1272	        user_message: str,
  1273	    ) -> None:
  1274	        user_msg = Message(session_id=session_id, role="user", content=user_message)
  1275	        db.add(user_msg)
  1276	        await db.commit()
  1277	
  1278	        session = await db.get(ChatSession, session_id)
  1279	        if session and not session.title:
  1280	            clean = user_message.replace("\n", " ").replace("\r", "").strip()
  1281	            session.title = clean[:50]
  1282	            await db.commit()
  1283	
  1284	    async def _tool_action_stream(
  1285	        self,
  1286	        *,
  1287	        session_id: uuid.UUID,
  1288	        user_message: str,
  1289	        db: AsyncSession,
  1290	        user: Optional[User],
  1291	        locale: Optional[str],
  1292	        domain_mode: Optional[str],
  1293	        document_id: uuid.UUID | None,
  1294	        collection_doc_ids: list[uuid.UUID],
  1295	        action_plan: Any,
  1296	    ) -> AsyncGenerator[Dict[str, Any], None]:
  1297	        try:
  1298	            await self._persist_user_message_and_title(
  1299	                db=db,
  1300	                session_id=session_id,
  1301	                user_message=user_message,
  1302	            )
  1303	            if action_plan.user_visible_status:
  1304	                yield sse("tool_status", {"message": action_plan.user_visible_status})
  1305	            execution = await chat_tool_executor.execute(
  1306	                action_plan,
  1307	                user=user,
  1308	                db=db,
  1309	                document_id=document_id,
  1310	                collection_doc_ids=collection_doc_ids,
  1311	                locale=locale,
  1312	                domain_mode=domain_mode,
  1313	            )
  1314	            assistant_text = execution.message
  1315	            artifact_payload = execution.artifact.to_payload() if execution.artifact else None
  1316	            if artifact_payload:
  1317	                yield sse("artifact", artifact_payload)
  1318	            if assistant_text:
  1319	                yield sse("token", {"text": assistant_text})
  1320	
  1321	            asst_msg = Message(
  1322	                session_id=session_id,
  1323	                role="assistant",
  1324	                content=assistant_text,
  1325	                citations=(artifact_payload or {}).get("citations") if artifact_payload else None,
  1326	                metadata_json={
  1327	                    "action_plan": {
  1328	                        "action": action_plan.action.value,
  1329	                        "confidence": action_plan.confidence,
  1330	                        "reason": action_plan.reason,
  1331	                    },
  1332	                    "artifacts": [artifact_payload] if artifact_payload else [],
  1333	                },
  1334	            )
  1335	            db.add(asst_msg)
  1336	            await db.commit()
  1337	            yield sse(
  1338	                "done",
  1339	                {
  1340	                    "message_id": str(asst_msg.id),
  1341	                    "citations_count": 0,
  1342	                    "verification": None,
  1343	                    "can_continue": False,
  1344	                    "continuation_count": asst_msg.continuation_count,
  1345	                    "artifact_count": 1 if artifact_payload else 0,
  1346	                },
  1347	            )
  1348	        except Exception as exc:
  1349	            await db.rollback()
  1350	            yield _safe_sse("error", "CHAT_SETUP_ERROR", exc, session_id=str(session_id))
  1351	
  1352	    async def _run_verified_quote_search(
  1353	        self,
  1354	        *,
  1355	        session_id: uuid.UUID,
  1356	        db: AsyncSession,
  1357	        document: Document,
  1358	        user: User,
  1359	        topic: str,
  1360	        locale: Optional[str],
  1361	        pre_debited: int,
  1362	        predebit_ledger_id: uuid.UUID,
  1363	        progress: "_VerifiedQuoteProgress",
  1364	    ) -> "_VerifiedQuoteOutcome":
  1365	        """Strict verbatim-quote chat routing (B5, plan §8.4.3).
  1366	
  1367	        Runs B3's verified quote_search in place of the normal LLM answer,
  1368	        persists the assistant message, and reconciles + records usage — ALL
  1369	        of it awaited here, nothing yielded. `progress` is mutated as this
  1370	        proceeds (model/tokens as soon as quote_search() returns,
  1470	            progress.prompt_tokens, progress.completion_tokens, progress.model, mode="balanced",
  1471	        )
  1472	        await credit_service.reconcile_credits(
  1473	            db, user.id, predebit_ledger_id, pre_debited, actual_cost,
  1474	        )
  1475	        await credit_service.record_usage(
  1476	            db,
  1477	            user_id=user.id,
  1478	            message_id=message_id,
  1479	            model=progress.model,
  1480	            prompt_tokens=progress.prompt_tokens,
  1481	            completion_tokens=progress.completion_tokens,
  1482	            cost_credits=actual_cost,
  1483	        )
  1484	        await db.commit()
  1485	        # Only trustworthy once the atomic commit's await has ACTUALLY
  1486	        # returned — the ordinary-exception handler (FIX-4) uses this to
  1487	        # know whether a real answer was delivered.
  1488	        progress.message_id = message_id
  1489	
  1490	        return _VerifiedQuoteOutcome(
  1491	            message_id=message_id,
  1492	            assistant_text=assistant_text,
  1493	            citations=citations,
  1494	            artifact_payload=artifact_payload,
  1495	        )
  1496	
  1497	    async def chat_stream(
  1498	        self,
  1499	        session_id: uuid.UUID,
  1500	        user_message: str,
  1501	        db: AsyncSession,
  1502	        user: Optional[User] = None,
  1503	        locale: Optional[str] = None,
  1504	        mode: Optional[str] = None,
  1505	        domain_mode: Optional[str] = None,
  1506	    ) -> AsyncGenerator[Dict[str, Any], None]:
  1507	        """Main chat streaming generator producing SSE event dicts.
  1508	
  1509	        Steps per spec:
  1510	        1) Load session + document
  1511	        2) Save user message
  1512	        3) Load recent history (last MAX_CHAT_HISTORY_TURNS rounds)
  1513	        4) Retrieval top-5
  1514	        5) Build prompt with numbered chunks
  1515	        6) Stream Anthropic
  1516	        7) Parse with RefParserFSM and yield events; ping every 15s
  1517	        8) Save assistant message + citations
  1518	        9) Yield done
  1519	        """
  1520	
  1521	        # 1) Load session
  1522	        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
  1523	        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
  1524	        if not session_obj:
  1525	            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "会话不存在"})
  1526	            return
  1527	
  1528	        document_id = session_obj.document_id
  1529	        collection_id = getattr(session_obj, "collection_id", None)
  1530	        is_collection_session = collection_id is not None and document_id is None
  1531	
  1532	        # Load document for custom instructions (single-doc sessions)
  1533	        doc = await db.get(Document, document_id) if document_id else None
  1534	
  1535	        # For collection sessions, load all document IDs and filenames
  1536	        collection_doc_ids: List[uuid.UUID] = []
  1537	        collection_doc_names: dict[uuid.UUID, str] = {}
  1538	        collection_doc_types: dict[uuid.UUID, str] = {}
  1539	        collection_doc_pages: dict[uuid.UUID, int] = {}
  1540	        if is_collection_session:
  1541	            cd_rows = await db.execute(
  1542	                select(collection_documents.c.document_id).where(
  1543	                    collection_documents.c.collection_id == collection_id
  1544	                )
  1545	            )
  1546	            collection_doc_ids = [row[0] for row in cd_rows.all()]
  1547	            if collection_doc_ids:
  1548	                doc_rows = await db.execute(
  1549	                    select(Document.id, Document.filename, Document.file_type, Document.page_count)
  1550	                    .where(Document.id.in_(collection_doc_ids))
  1551	                )
  1552	                for drow in doc_rows.all():
  1553	                    collection_doc_names[drow[0]] = drow[1]
  1554	                    collection_doc_types[drow[0]] = drow[2]
  1555	                    if drow[3]:
  1556	                        collection_doc_pages[drow[0]] = drow[3]
  1557	
  1558	        # Resolve mode → model (mode is the ONLY way to select a model)
  1559	        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
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
  1990	            elif retrieval_strategy == "document_summary_context":
  1991	                map_reduce_rule = (
  1992	                    "7. The sources may be map-reduce section summaries generated from source chunks; "
  1993	                    "use the coverage status to distinguish model-covered, fallback, and missing sections.\n"
  1994	                    if has_map_reduce_summary_context
  1995	                    else ""
  1996	                )
  1997	                system_prompt = (
  1998	                    "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
  1999	                    + SYSTEM_PROMPT_META_RULE
  2000	                    + "## Document Coverage Sources\n"
  2001	                    + (
  2002	                        "\n".join(numbered_chunks)
  2003	                        if numbered_chunks
  2004	                        else "(none)"
  2005	                    )
  2006	                    + "\n\n## Summary Rules\n"
  2007	                    + "1. Treat these sources as representative coverage selected across the document, not as semantic search results for a narrow question.\n"
  2008	                    + "2. Do NOT say the user's ready document is not a complete document merely because the context is selective.\n"
  2009	                    + "3. Produce a useful document-level summary with clear headings, key points, and important caveats when supported.\n"
  2010	                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
  2011	                    + "5. Cite every factual paragraph or bullet using the source numbers listed above.\n"
  2012	                    + "6. Your response language MUST match the language of the user's question.\n"
  2013	                    + map_reduce_rule
  2014	                    + _summary_coverage_contract(retrieved)
  2015	                    + _citation_contract()
  2016	                )
  2017	            else:
  2018	                system_prompt = (
  2019	                    "You are a document analysis assistant. Answer the user's question based on the following document sources.\n\n"
  2020	                    + SYSTEM_PROMPT_META_RULE
  2021	                    + "## Document Sources\n"
  2022	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2023	                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
  2024	                    + _query_plan_contract(retrieval_plan)
  2025	                    + "\n\n## Rules\n" + rules
  2026	                    + _citation_contract()
  2027	                )
  2028	
  2029	            # Inject custom instructions if present (subordinate to core rules — they are
  2030	            # user preferences, not overrides of role/source/citation/safety rules).
  2031	            if doc and doc.custom_instructions:
  2032	                system_prompt += (
  2033	                    "\n## Custom Instructions\n"
  2034	                    "Follow these custom instructions only when they do not conflict with the role, "
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
  2510	                try:
  2511	                    with anyio.CancelScope(shield=True):
  2512	                        await asyncio.wait_for(
  2513	                            _settle_predebit_on_cancel(
  2514	                                user_id=user.id,
  2515	                                pre_debited=pre_debited,
  2516	                                predebit_ledger_id=predebit_ledger_id,
  2517	                                has_answer=has_partial_answer,
  2518	                                prompt_tokens=prompt_tokens,
  2519	                                output_tokens=output_tokens,
  2520	                                model=effective_model,
  2521	                                mode=effective_mode,
  2522	                            ),
  2523	                            timeout=_CANCEL_IO_TIMEOUT_S,
  2524	                        )
  2525	                    settled = True
  2526	                except Exception:
  2527	                    logger.exception(
  2528	                        "Failed to settle pre-debit on cancel/error for user %s",
  2529	                        user.id,
  2530	                    )
  2531	
  2532	    async def continue_stream(
  2533	        self,
  2534	        session_id: uuid.UUID,
  2535	        message_id: Optional[uuid.UUID],
  2536	        db: AsyncSession,
  2537	        user: Optional[User] = None,
  2538	        locale: Optional[str] = None,
  2539	        mode: Optional[str] = None,
  2540	    ) -> AsyncGenerator[Dict[str, Any], None]:
  2541	        """Continue a truncated assistant response, appending to the existing message."""
  2542	
  2543	        # 1) Load session
  2544	        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
  2545	        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
  2546	        if not session_obj:
  2547	            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "Session not found"})
  2548	            return
  2549	
  2550	        document_id = session_obj.document_id
  2551	        collection_id = getattr(session_obj, "collection_id", None)
  2552	        is_collection_session = collection_id is not None and document_id is None
  2553	
  2554	        doc = await db.get(Document, document_id) if document_id else None
  2555	
  2556	        # For collection sessions, load document names
  2557	        collection_doc_names: dict[uuid.UUID, str] = {}
  2558	        collection_doc_types: dict[uuid.UUID, str] = {}
  2559	        collection_doc_pages: dict[uuid.UUID, int] = {}
  2560	        if is_collection_session:
  2561	            from app.models.tables import collection_documents as cd_table
  2562	            cd_rows = await db.execute(
  2563	                select(cd_table.c.document_id).where(cd_table.c.collection_id == collection_id)
  2564	            )
  2565	            collection_doc_ids = [r[0] for r in cd_rows.all()]
  2566	            if collection_doc_ids:
  2567	                doc_rows = await db.execute(
  2568	                    select(Document.id, Document.filename, Document.file_type, Document.page_count)
  2569	                    .where(Document.id.in_(collection_doc_ids))
  2570	                )
  2571	                for drow in doc_rows.all():
  2572	                    collection_doc_names[drow[0]] = drow[1]
  2573	                    collection_doc_types[drow[0]] = drow[2]
  2574	                    if drow[3]:
  2575	                        collection_doc_pages[drow[0]] = drow[3]
  2576	
  2577	        # 2) Load assistant message to continue
  2578	        if message_id:
  2579	            asst_msg = await db.get(Message, message_id)
  2580	        else:
  2581	            # Fall back to most recent assistant message in session
  2582	            result = await db.execute(
  2583	                select(Message)
  2584	                .where(Message.session_id == session_id, Message.role == "assistant")
  2585	                .order_by(Message.created_at.desc())
  2586	                .limit(1)
  2587	            )
  2588	            asst_msg = result.scalar_one_or_none()
  2589	
  2590	        if not asst_msg or asst_msg.role != "assistant":
  2591	            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Assistant message not found"})
  2592	            return
  2593	
  2594	        if asst_msg.session_id != session_id:
  2595	            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Message does not belong to this session"})
  2596	            return
  2597	
  2598	        # 3) Check continuation limit
  2599	        if asst_msg.continuation_count >= settings.MAX_CONTINUATIONS_PER_MESSAGE:
  2600	            yield sse("error", {"code": "CONTINUATION_LIMIT", "message": "Maximum continuations reached"})
  2601	            return
  2602	
  2603	        # 4) Resolve mode → model
  2604	        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
  2605	        effective_model = settings.MODE_MODELS[effective_mode]
  2606	
  2607	        if user is None and doc and doc.demo_slug:
  2608	            effective_model = settings.DEMO_LLM_MODEL
  2609	            effective_mode = "quick"
  2610	
  2611	        if effective_mode in settings.PREMIUM_MODES:
  2612	            user_plan = (user.plan or "free").lower() if user else "free"
  2613	            if user_plan == "free":
  2614	                yield sse(
  2615	                    "error",
  2616	                    {
  2617	                        "code": "MODE_NOT_ALLOWED",
  2618	                        "message": "Upgrade to Plus to use this mode",
  2619	                        "required_plan": "plus",
  2620	                    },
  2621	                )
  2622	                return
  2623	
  2624	        # 5) Pre-debit credits
  2625	        pre_debited = 0
  2626	        predebit_ledger_id = None
  2627	        if user is not None:
  2628	            estimated = credit_service.get_estimated_cost(effective_mode)
  2629	            predebit_ledger_id = await credit_service.debit_credits(
  2630	                db, user_id=user.id, cost=estimated,
  2631	                reason="chat", ref_type="mode", ref_id=effective_mode,
  2632	            )
  2633	            if predebit_ledger_id:
  2634	                pre_debited = estimated
  2635	                await db.commit()
  2636	            else:
  2637	                balance = await credit_service.get_user_credits(db, user.id)
  2638	                yield sse("error", {
  2639	                    "code": "INSUFFICIENT_CREDITS",
  2640	                    "message": "Insufficient credits",
  2641	                    "required": estimated,
  2642	                    "balance": balance,
  2643	                })
  2644	                return
  2645	
  2646	        settled = False
  2647	        try:
  2648	            # 6) Reconstruct chunk_map from original citations
  2649	            chunk_map: dict[int, _ChunkInfo] = {}
  2650	            original_citations = asst_msg.citations or []
  2651	            if original_citations:
  2652	                chunk_ids_set: set[str] = set()
  2653	                ref_to_chunk_id: dict[int, str] = {}
  2654	                ref_to_citation: dict[int, dict] = {}
  2655	                table_ids_set: set[str] = set()
  2656	                for cit in original_citations:
  2657	                    if not isinstance(cit, dict):
  2658	                        continue
  2659	                    cid = cit.get("chunk_id")
  2660	                    ref = cit.get("ref_index")
  2661	                    if cid and ref is not None:
  2662	                        try:
  2663	                            normalized_ref = int(ref)
  2664	                            normalized_cid = str(uuid.UUID(str(cid)))
  2665	                        except Exception:
  2666	                            continue
  2667	                        chunk_ids_set.add(normalized_cid)
  2668	                        ref_to_chunk_id[normalized_ref] = normalized_cid
  2669	                        ref_to_citation[normalized_ref] = cit
  2670	                        table_id = cit.get("table_id")
  2671	                        if table_id:
  2672	                            try:
  2673	                                table_ids_set.add(str(uuid.UUID(str(table_id))))
  2674	                            except Exception:
  2675	                                pass
  2676	
  2677	                if chunk_ids_set:
  2678	                    chunk_uuids = [uuid.UUID(c) for c in chunk_ids_set]
  2679	                    chunk_rows = await db.execute(
  2680	                        select(Chunk).where(Chunk.id.in_(chunk_uuids))
  2681	                    )
  2682	                    chunks_by_id: dict[str, Chunk] = {}
  2683	                    for ch in chunk_rows.scalars():
  2684	                        chunks_by_id[str(ch.id)] = ch
  2685	
  2686	                    tables_by_id: dict[str, DocumentTable] = {}
  2687	                    if table_ids_set:
  2688	                        table_uuids = [uuid.UUID(tid) for tid in table_ids_set]
  2689	                        table_rows = await db.execute(
  2690	                            select(DocumentTable).where(DocumentTable.id.in_(table_uuids))
  2691	                        )
  2692	                        for table in table_rows.scalars():
  2693	                            tables_by_id[str(table.id)] = table
  2694	
  2695	                    for ref_num, cid in ref_to_chunk_id.items():
  2696	                        ch = chunks_by_id.get(cid)
  2697	                        if ch:
  2698	                            citation = dict(ref_to_citation.get(ref_num) or {})
  2699	                            table_id = citation.get("table_id")
  2700	                            if table_id and not citation.get("table_context"):
  2701	                                table = tables_by_id.get(str(table_id))
  2702	                                if table:
  2703	                                    citation["table_context"] = table_evidence_text(table)
  2704	                                    citation["page"] = table.page
  2705	                                    citation["page_end"] = table.page
  2706	                            chunk_map[ref_num] = _chunk_info_from_persisted_citation(
  2707	                                ch,
  2708	                                citation,
  2709	                                collection_doc_names,
  2710	                            )
    90	        return None
    91	    return doc
    92	
    93	
    94	async def _enforce_free_extraction_limit(user: User, db: AsyncSession) -> bool:
    95	    if (user.plan or "free").lower() != "free":
    96	        return True
    97	    window_start = _as_utc(user.monthly_credits_granted_at)
    98	    if window_start is None:
    99	        window_start = datetime.now(timezone.utc) - timedelta(days=30)
   100	    used = await db.scalar(
   101	        select(func.count())
   102	        .select_from(DocumentJob)
   103	        .where(DocumentJob.user_id == user.id)
   104	        .where(DocumentJob.job_type == EXTRACTION_JOB_TYPE)
   105	        .where(DocumentJob.status.in_(["queued", "running", "succeeded"]))
   106	        .where(DocumentJob.created_at >= window_start)
   107	    )
   108	    return int(used or 0) < FREE_MONTHLY_EXTRACTION_LIMIT
   109	
   110	
   111	async def _queue_extraction(
   112	    *,
   113	    user: User,
   114	    db: AsyncSession,
   115	    doc: Document,
   116	    plan: ActionPlan,
   117	    locale: str | None,
   118	    domain_mode: str | None,
   119	) -> ToolExecution:
   120	    template_key = plan.template_key or "executive_summary"
   121	    try:
   122	        template = get_template(template_key)
   123	    except ValueError:
   124	        template = get_template("executive_summary")
   125	
   126	    if not await _enforce_free_extraction_limit(user, db):
   127	        return ToolExecution(
   128	            message=_copy(
   129	                plan,
   130	                en="You have used the free structured extraction allowance. Upgrade to continue creating cited deliverables.",
   131	                zh="你已经用完免费结构化提取额度。升级后可以继续生成带引用的交付物。",
   132	            ),
   133	            artifact=ChatArtifact(
   134	                artifact_type="extraction",
   135	                status="failed",
   136	                title=template.title,
   137	                summary="Structured extraction limit reached.",
   138	                required_plan="plus",
   139	            ),
   140	        )
   141	
   142	    job = DocumentJob(
   143	        user_id=user.id,
   144	        document_id=doc.id,
   145	        job_type=EXTRACTION_JOB_TYPE,
   146	        status="queued",
   147	        input_scope={
   148	            "template_key": template.key,
   149	            "locale": locale,
   150	            "domain_mode": domain_mode,
   151	            "source": "chat",
   152	        },
   153	    )
   154	    db.add(job)
   155	    await db.flush()
   156	    ledger_id = await credit_service.debit_credits(
   157	        db,
   158	        user_id=user.id,
   159	        cost=EXTRACTION_PREDEBIT_CREDITS,
   160	        reason="extraction",
   161	        ref_type="document_job",
   162	        ref_id=str(job.id),
   163	    )
   164	    if ledger_id is None:
   165	        await db.rollback()
   166	        balance = await credit_service.get_user_credits(db, user.id)
   167	        return ToolExecution(
   168	            message=_copy(
   169	                plan,
   170	                en=f"This extraction needs {EXTRACTION_PREDEBIT_CREDITS} credits, but your balance is {balance}.",
   171	                zh=f"这次提取需要 {EXTRACTION_PREDEBIT_CREDITS} 额度，但你当前余额是 {balance}。",
   172	            ),
   173	            artifact=ChatArtifact(
   174	                artifact_type="extraction",
   175	                status="failed",
   380	    if export_requested:
   381	        if plan_name in {"plus", "pro"}:
   382	            export_urls.append({"label": "Download CSV", "format": "csv", "url": f"/api/documents/{doc.id}/tables/export"})
   383	        else:
   384	            required_plan = "plus"
   385	
   386	    artifact = ChatArtifact(
   387	        artifact_type="table_export" if export_requested else "table_scan",
   388	        status=job.status,
   389	        job_id=str(job.id),
   390	        title="Tables",
   391	        summary=plan.user_visible_status or "Scanning document tables.",
   392	        download_urls=export_urls,
   393	        required_plan=required_plan,
   394	        warning="CSV export requires Plus." if required_plan else None,
   395	    )
   396	    return ToolExecution(
   397	        message=_copy(
   398	            plan,
   399	            en="I started scanning the document tables. The result will update here when the scan finishes.",
   400	            zh="我已开始扫描文档表格。完成后结果会在这里更新。",
   401	        ),
   402	        artifact=artifact,
   403	    )
   404	
   405	
   406	class ChatToolExecutor:
   407	    async def execute(
   408	        self,
   409	        plan: ActionPlan,
   410	        *,
   411	        user: User | None,
   412	        db: AsyncSession,
   413	        document_id: uuid.UUID | None,
   414	        collection_doc_ids: list[uuid.UUID],
   415	        locale: str | None,
   416	        domain_mode: str | None,
   417	    ) -> ToolExecution:
   418	        if user is None:
   419	            return ToolExecution(
   420	                message="Please sign in to create exports, structured extractions, templates, or document comparisons.",
   421	                artifact=None,
   422	            )
   423	
   424	        if plan.action in {ChatAction.CREATE_QUESTION_TEMPLATE, ChatAction.RUN_QUESTION_TEMPLATE}:
   425	            return ToolExecution(
   426	                message=plan.user_visible_status
   427	                or "Send the checklist questions in chat, one per line, and I can turn them into a reusable template.",
   428	                artifact=None,
   429	            )
   430	
   431	        if plan.action == ChatAction.COMPARE_DOCUMENTS:
   432	            if len(plan.document_ids) >= 2:
   433	                return ToolExecution(
   434	                    message="Document comparison from chat is ready to route, but I need the selected old/new document ids confirmed before spending Pro credits.",
   435	                    artifact=None,
   436	                )
   437	            if collection_doc_ids:
   438	                count = len(collection_doc_ids)
   439	                return ToolExecution(
   440	                    message=f"I found {count} document(s) in this collection. Tell me which two versions to compare, for example: compare A.pdf with B.pdf.",
   441	                    artifact=None,
   442	                )
   443	            return ToolExecution(
   444	                message=plan.user_visible_status
   445	                or "Please upload or choose the old version and the new version before I run a cited comparison.",
   446	                artifact=None,
   447	            )
   448	
   449	        if document_id is None:
   450	            return ToolExecution(
   451	                message="This action needs a single active document. Open a document and ask again.",
   452	                artifact=None,
   453	            )
   454	        doc = await _verify_document(document_id, user, db)
   455	        if not doc:
   456	            return ToolExecution(
   457	                message="I could not access that document.",
   458	                artifact=None,
   459	            )
   460	        if doc.status != "ready":
   461	            return ToolExecution(
   462	                message="The document is still processing. Try again when it is ready.",
   463	                artifact=None,
   464	            )
   465	
   466	        if plan.action == ChatAction.EXTRACT_DELIVERABLE:
   467	            return await _queue_extraction(
   468	                user=user,
   469	                db=db,
   470	                doc=doc,
   471	                plan=plan,
   472	                locale=locale,
   473	                domain_mode=domain_mode,
   474	            )
   475	        if plan.action in {ChatAction.SCAN_TABLES, ChatAction.EXPORT_TABLES}:
   476	            return await _queue_table_scan(
   477	                user=user,
   478	                db=db,
   479	                doc=doc,
   480	                export_requested=plan.action == ChatAction.EXPORT_TABLES,
   481	                plan=plan,
   482	            )
   483	
   484	        return ToolExecution(
   485	            message="I can answer that directly in chat.",
   486	            artifact=None,
   487	        )
   488	
   489	
   490	chat_tool_executor = ChatToolExecutor()
     1	"""Structured extraction APIs for the document workbench."""
     2	from __future__ import annotations
     3	
     4	import re
     5	import uuid
     6	from datetime import datetime, timedelta, timezone
     7	from typing import Any, Literal
     8	from urllib.parse import quote
     9	
    10	import sqlalchemy as sa
    11	from fastapi import APIRouter, Depends, HTTPException, Query, status
    12	from fastapi.responses import StreamingResponse
    13	from pydantic import BaseModel, Field
    14	from sqlalchemy import func, select
    15	from sqlalchemy.ext.asyncio import AsyncSession
    16	from sqlalchemy.orm import selectinload
    17	
    18	from app.core.deps import get_db_session, require_auth
    19	from app.models.tables import (
    20	    CreditLedger,
    21	    Document,
    22	    DocumentJob,
    23	    ProductEvent,
    24	    User,
    25	)
    26	from app.services import credit_service
    27	from app.services.doc_service import can_access_document
    28	from app.services.extraction_service import (
    29	    EXTRACTION_JOB_TYPE,
    30	    EXTRACTION_PREDEBIT_CREDITS,
    31	    FREE_MONTHLY_EXTRACTION_LIMIT,
    32	    get_template,
    33	    list_templates,
    34	    render_csv,
    35	)
    36	
    37	router = APIRouter(prefix="/api", tags=["extractions"])
    38	
    39	
    40	class ExtractionTemplateResponse(BaseModel):
    41	    key: str
    42	    title: str
    43	    description: str
    44	
    45	
    46	class CreateExtractionRequest(BaseModel):
    47	    template_key: str = Field(..., min_length=1, max_length=64)
    48	    locale: str | None = Field(None, max_length=16)
    49	    domain_mode: Literal["legal", "academic"] | None = None
    50	
    51	
    52	class ExtractionResultPayload(BaseModel):
    53	    template_key: str
    54	    structured_json: dict[str, Any]
    55	    rendered_markdown: str
    56	    citations: list[dict[str, Any]]
    57	    created_at: str
    58	
    59	
    60	class ExtractionJobResponse(BaseModel):
    61	    id: str
    62	    document_id: str | None
    63	    collection_id: str | None
    64	    job_type: str
    65	    status: str
    66	    input_scope: dict[str, Any]
    67	    cost_credits: int
    68	    error_code: str | None
    69	    error_message: str | None
    70	    created_at: str
    71	    updated_at: str
    72	    completed_at: str | None
    73	    result: ExtractionResultPayload | None = None
    74	
    75	
    76	def _as_utc(dt):
    77	    if dt is None:
    78	        return None
    79	    if dt.tzinfo is None:
    80	        return dt.replace(tzinfo=timezone.utc)
    81	    return dt.astimezone(timezone.utc)
    82	
    83	
    84	def _content_disposition(filename: str) -> str:
    85	    clean = re.sub(r"[\r\n\t]", " ", filename)
    86	    ascii_fallback = clean.encode("ascii", "replace").decode("ascii")
    87	    ascii_fallback = re.sub(r'[?"\\]', "_", ascii_fallback)
    88	    if not ascii_fallback.strip("_. "):
    89	        ascii_fallback = "extraction"
    90	    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(clean, safe='')}"
    91	
    92	
    93	def _loaded_extraction_result(job: Any) -> Any | None:
    94	    # Async SQLAlchemy cannot lazy-load relationships during response building.
    95	    # Use only values already loaded by selectinload or explicitly assigned.
    96	    return job.__dict__.get("extraction_result")
    97	
    98	
    99	def _job_response(job: DocumentJob) -> ExtractionJobResponse:
   100	    result = None
   101	    er = _loaded_extraction_result(job)
   102	    if er:
   103	        result = ExtractionResultPayload(
   104	            template_key=er.template_key,
   105	            structured_json=er.structured_json or {},
   106	            rendered_markdown=er.rendered_markdown or "",
   107	            citations=er.citations or [],
   108	            created_at=er.created_at.isoformat(),
   109	        )
   110	    return ExtractionJobResponse(
   111	        id=str(job.id),
   112	        document_id=str(job.document_id) if job.document_id else None,
   113	        collection_id=str(job.collection_id) if job.collection_id else None,
   114	        job_type=job.job_type,
   115	        status=job.status,
   116	        input_scope=job.input_scope or {},
   117	        cost_credits=int(job.cost_credits or 0),
   118	        error_code=job.error_code,
   119	        error_message=job.error_message,
   120	        created_at=job.created_at.isoformat(),
   121	        updated_at=job.updated_at.isoformat(),
   122	        completed_at=job.completed_at.isoformat() if job.completed_at else None,
   123	        result=result,
   124	    )
   125	
   126	
   127	async def _verify_document(document_id: uuid.UUID, user: User, db: AsyncSession) -> Document:
   128	    doc = await db.get(Document, document_id)
   129	    if not doc or not can_access_document(doc, user):
   130	        raise HTTPException(
   131	            status_code=404,
   132	            detail={"error": "DOCUMENT_NOT_FOUND", "message": "Document not found"},
   133	        )
   134	    return doc
   135	
   136	
   137	async def _enforce_free_extraction_limit(user: User, db: AsyncSession) -> None:
   138	    if (user.plan or "free").lower() != "free":
   139	        return
   140	    window_start = _as_utc(user.monthly_credits_granted_at)
   141	    if window_start is None:
   142	        window_start = datetime.now(timezone.utc) - timedelta(days=30)
   143	    used = await db.scalar(
   144	        select(func.count())
   145	        .select_from(DocumentJob)
   146	        .where(DocumentJob.user_id == user.id)
   147	        .where(DocumentJob.job_type == EXTRACTION_JOB_TYPE)
   148	        .where(DocumentJob.status.in_(["queued", "running", "succeeded"]))
   149	        .where(DocumentJob.created_at >= window_start)
   150	    )
   151	    if int(used or 0) >= FREE_MONTHLY_EXTRACTION_LIMIT:
   152	        raise HTTPException(
   153	            status_code=403,
   154	            detail={
   155	                "error": "EXTRACTION_LIMIT_REACHED",
   156	                "message": "Free plan structured extraction limit reached",
   157	                "limit": FREE_MONTHLY_EXTRACTION_LIMIT,
   158	                "used": int(used or 0),
   159	                "required_plan": "plus",
   160	            },
   161	        )
   162	
   163	
   164	@router.get("/extraction-templates", response_model=list[ExtractionTemplateResponse])
   165	async def get_extraction_templates() -> list[dict[str, str]]:
   166	    return list_templates()
   167	
   168	
   169	@router.post(
   170	    "/documents/{document_id}/extractions",
   171	    response_model=ExtractionJobResponse,
   172	    status_code=status.HTTP_202_ACCEPTED,
   173	)
   174	async def create_extraction(
   175	    document_id: uuid.UUID,
   176	    body: CreateExtractionRequest,
   177	    user: User = Depends(require_auth),
   178	    db: AsyncSession = Depends(get_db_session),
   179	):
   180	    doc = await _verify_document(document_id, user, db)
   181	    if doc.status != "ready":
   182	        raise HTTPException(
   183	            status_code=409,
   184	            detail={"error": "DOCUMENT_NOT_READY", "message": "Document is not ready"},
   185	        )
   186	
   187	    # P1 hygiene follow-up (2026-08-03): domain_mode ("legal"/"academic")
   188	    # is a Plus+ feature (see app/api/chat.py's chat_stream for the
   189	    # primary gate + rationale — the frontend disables the selector for
   190	    # free users, but the backend accepted it unconditionally). This is
   191	    # the SECOND entry point that accepted it with zero plan check — a
   192	    # free/anon user could POST it directly on an extraction job and get
   193	    # the paid domain-rules prompt behavior. Same gate, same error shape.
   194	    if body.domain_mode is not None:
   195	        plan = (user.plan or "free").lower() if user is not None else "free"
   196	        if plan not in {"plus", "pro"}:
   197	            raise HTTPException(
   198	                status_code=403,
   199	                detail={
   200	                    "error": "DOMAIN_MODE_REQUIRES_PLUS",
   201	                    "message": "Legal/Academic domain mode requires a Plus or Pro plan",
   202	                    "required_plan": "plus",
   203	                },
   204	            )
   205	
   206	    try:
   207	        template = get_template(body.template_key)
   208	    except ValueError:
   209	        raise HTTPException(
   210	            status_code=400,
   211	            detail={"error": "UNSUPPORTED_EXTRACTION_TEMPLATE", "message": "Unsupported extraction template"},
   212	        )
   213	
   214	    await _enforce_free_extraction_limit(user, db)
   215	
   216	    job = DocumentJob(
   217	        user_id=user.id,
   218	        document_id=doc.id,
   219	        job_type=EXTRACTION_JOB_TYPE,
   220	        status="queued",
   221	        input_scope={
   222	            "template_key": template.key,
   223	            "locale": body.locale,
   224	            "domain_mode": body.domain_mode,
   225	        },
   226	    )
   227	    db.add(job)
   228	    await db.flush()
   229	
   230	    ledger_id = await credit_service.debit_credits(
   231	        db,
   232	        user_id=user.id,
   233	        cost=EXTRACTION_PREDEBIT_CREDITS,
   234	        reason="extraction",
   235	        ref_type="document_job",
   236	        ref_id=str(job.id),
   237	    )
   238	    if ledger_id is None:
   239	        await db.rollback()
   240	        balance = await credit_service.get_user_credits(db, user.id)
   241	        raise HTTPException(
   242	            status_code=402,
   243	            detail={
   244	                "error": "INSUFFICIENT_CREDITS",
   245	                "message": "Insufficient credits to start extraction",
   246	                "required": EXTRACTION_PREDEBIT_CREDITS,
   247	                "balance": balance,
   248	            },
   249	        )
   250	
   251	    job.metadata_json = {
   252	        "predebit_ledger_id": str(ledger_id),
   253	        "pre_debited": EXTRACTION_PREDEBIT_CREDITS,
   254	    }
   255	    db.add(
   256	        ProductEvent(
   257	            user_id=user.id,
   258	            event_name="extraction_created",
   259	            source="document_reader",
   260	            reason=template.key,
   261	            plan=(user.plan or "free").lower(),
   262	            metadata_json={"document_id": str(doc.id), "job_id": str(job.id), "template_key": template.key},
   263	        )
   264	    )
   265	    await db.commit()
   266	    await db.refresh(job)
   267	
   268	    try:
   269	        from app.workers.extraction_worker import run_extraction_job
   270	
   271	        run_extraction_job.delay(str(job.id))
   272	    except Exception as exc:
   273	        job.status = "failed"
   274	        job.error_code = "EXTRACTION_QUEUE_FAILED"
   275	        job.error_message = "Failed to queue extraction"
   276	        result = await db.execute(sa.delete(CreditLedger).where(CreditLedger.id == ledger_id))
   277	        if result.rowcount and result.rowcount > 0:
   278	            await db.execute(
   279	                sa.update(User)
   280	                .where(User.id == user.id)
   281	                .values(credits_balance=User.credits_balance + EXTRACTION_PREDEBIT_CREDITS)
   282	            )
   283	        await db.commit()
   284	        raise HTTPException(
   285	            status_code=500,
   286	            detail={"error": "EXTRACTION_QUEUE_FAILED", "message": "Failed to queue extraction"},
   287	        ) from exc
   288	
   289	    return _job_response(job)
   290	
   291	
   292	@router.get("/documents/{document_id}/extractions", response_model=list[ExtractionJobResponse])
   293	async def list_document_extractions(
   294	    document_id: uuid.UUID,
   295	    user: User = Depends(require_auth),
   296	    db: AsyncSession = Depends(get_db_session),
   297	):
   298	    doc = await _verify_document(document_id, user, db)
   299	    rows = await db.execute(
   300	        select(DocumentJob)
   301	        .options(selectinload(DocumentJob.extraction_result))
   302	        .where(DocumentJob.user_id == user.id)
   303	        .where(DocumentJob.document_id == doc.id)
   304	        .where(DocumentJob.job_type == EXTRACTION_JOB_TYPE)
   305	        .order_by(DocumentJob.created_at.desc())
   306	        .limit(20)
   307	    )
   308	    return [_job_response(job) for job in rows.scalars()]
   309	
   310	
   250	        .where(Chunk.document_id == document_id)
   251	        .order_by(Chunk.chunk_index)
   252	        .limit(max_chunks)
   253	    )
   254	    return [(chunk, 0.0) for chunk in rows.scalars()]
   255	
   256	
   257	def _context_text(chunks: Sequence[tuple[Chunk, float]]) -> str:
   258	    parts: list[str] = []
   259	    for idx, (chunk, _score) in enumerate(chunks, start=1):
   260	        text = (chunk.text or "").strip().replace("\x00", "")
   261	        if len(text) > MAX_CONTEXT_CHARS_PER_CHUNK:
   262	            text = text[:MAX_CONTEXT_CHARS_PER_CHUNK] + "..."
   263	        section = f" | section: {chunk.section_title}" if chunk.section_title else ""
   264	        parts.append(f"[{idx}] page {chunk.page_start}{section}\n{text}")
   265	    return "\n\n".join(parts)
   266	
   267	
   268	def _system_prompt(template: ExtractionTemplate, domain_mode: str | None) -> str:
   269	    domain = f"\nDomain mode: {domain_mode}." if domain_mode else ""
   270	    return (
   271	        "You are DocTalk's structured extraction engine. Extract only facts supported by the provided document excerpts. "
   272	        "Every extracted item must include source_refs using the bracket numbers of the excerpts that support it. "
   273	        "Do not invent facts. Respond only with valid JSON matching this contract:\n"
   274	        f"{template.json_contract}\n"
   275	        f"{domain}"
   276	    )
   277	
   278	
   279	def _user_prompt(template: ExtractionTemplate, chunks: Sequence[tuple[Chunk, float]], locale: str | None) -> str:
   280	    language_rule = f"Use the user's interface language if clear from this locale: {locale}." if locale else "Use the document language."
   281	    return (
   282	        f"Template: {template.title}\n"
   283	        f"Goal: {template.description}\n"
   284	        f"{language_rule}\n\n"
   285	        "Document excerpts:\n"
   286	        f"{_context_text(chunks)}"
   287	    )
   288	
   289	
   290	def _call_llm(template: ExtractionTemplate, chunks: Sequence[tuple[Chunk, float]], locale: str | None, domain_mode: str | None) -> tuple[dict[str, Any], int, int]:
   291	    client = _get_llm_client(EXTRACTION_MODEL)
   292	    messages = [
   293	        {"role": "system", "content": _system_prompt(template, domain_mode)},
   294	        {"role": "user", "content": _user_prompt(template, chunks, locale)},
   295	    ]
   296	    kwargs: dict[str, Any] = {
   297	        "model": EXTRACTION_MODEL,
   298	        "messages": messages,
   299	        "temperature": 0.1,
   300	        "max_tokens": 1800,
   301	    }
   302	    _apply_provider_options(kwargs, EXTRACTION_MODEL)
   303	    response = client.chat.completions.create(**kwargs)
   304	    content = response.choices[0].message.content or ""
   305	    usage = getattr(response, "usage", None)
   306	    prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
   307	    completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
   308	    try:
   309	        return _json_from_text(content), prompt_tokens, completion_tokens
   310	    except Exception:
   311	        repair_messages = [
   312	            {
   313	                "role": "system",
   314	                "content": "Repair the following model output into valid JSON only. Do not add commentary.",
   315	            },
   500	    if diff:
   501	        db.execute(
   502	            sa.update(User)
   503	            .where(User.id == user_id)
   504	            .values(credits_balance=User.credits_balance + diff)
   505	        )
   506	    db.execute(
   507	        sa.update(CreditLedger)
   508	        .where(CreditLedger.id == ledger_id)
   509	        .values(delta=-actual_cost, balance_after=CreditLedger.balance_after + diff)
   510	    )
   511	
   512	
   513	def run_extraction_job_sync(job_id: str) -> None:
   514	    from app.models.sync_database import SyncSessionLocal
   515	
   516	    job_uuid = uuid.UUID(job_id)
   517	    with SyncSessionLocal() as db:
   518	        job = db.get(DocumentJob, job_uuid)
   519	        if not job:
   520	            logger.warning("Extraction job %s not found", job_id)
   521	            return
   522	        if job.status not in ("queued", "running"):
   523	            return
   524	
   525	        job.status = "running"
   526	        job.updated_at = datetime.now(timezone.utc)
   527	        db.add(job)
   528	        db.commit()
   529	
   530	        pre_debited = int((job.metadata_json or {}).get("pre_debited") or 0)
   531	        ledger_raw = (job.metadata_json or {}).get("predebit_ledger_id")
   532	        ledger_id = uuid.UUID(str(ledger_raw)) if ledger_raw else None
   533	
   534	        try:
   535	            doc = db.get(Document, job.document_id) if job.document_id else None
   536	            if not doc or doc.status != "ready":
   537	                raise ValueError("DOCUMENT_NOT_READY")
   538	            template_key = str((job.input_scope or {}).get("template_key") or "")
   539	            template = get_template(template_key)
   540	            locale = (job.input_scope or {}).get("locale")
   541	            domain_mode = (job.input_scope or {}).get("domain_mode")
   542	            chunks = retrieve_extraction_chunks(db, doc.id, template)
   543	            if not chunks:
   544	                raise ValueError("NO_RETRIEVABLE_CHUNKS")
   545	
   546	            raw, prompt_tokens, completion_tokens = _call_llm(template, chunks, locale, domain_mode)
   547	            structured = normalize_result(template.key, raw, len(chunks))
   548	            rendered = render_markdown(template, structured)
   549	            refs = sorted({ref for ref in _walk_refs(structured) if 1 <= ref <= len(chunks)})
   550	            citations = [
   551	                _citation_from_chunk(ref, chunks[ref - 1][0], chunks[ref - 1][1])
   552	                for ref in refs
   553	            ]
   554	            actual_cost = calculate_cost(prompt_tokens, completion_tokens, EXTRACTION_MODEL, mode=EXTRACTION_MODE)
   555	            if ledger_id and pre_debited > 0:
   556	                _reconcile_sync(db, job.user_id, ledger_id, pre_debited, actual_cost)
   557	            db.add(
   558	                UsageRecord(
   559	                    user_id=job.user_id,
   560	                    message_id=None,
   561	                    model=EXTRACTION_MODEL,
   562	                    prompt_tokens=prompt_tokens,
   563	                    completion_tokens=completion_tokens,
   564	                    total_tokens=prompt_tokens + completion_tokens,
   565	                    cost_credits=actual_cost,
   566	                )
   567	            )
   568	            job.cost_credits = actual_cost
   569	            job.status = "succeeded"
   570	            job.error_code = None
   571	            job.error_message = None
   572	            job.completed_at = datetime.now(timezone.utc)
   573	            job.updated_at = job.completed_at
   574	            db.add(job)
   575	            db.add(
   576	                ExtractionResult(
   577	                    job_id=job.id,
   578	                    template_key=template.key,
   579	                    structured_json=structured,
   580	                    rendered_markdown=rendered,
backend/app/api/chat.py:391:    # P1 hygiene (top-down review, 2026-08-01): domain_mode ("legal"/
backend/app/api/chat.py:396:    # POST {"domain_mode": "legal"} and get the paid prompt behavior.
backend/app/api/chat.py:399:    if body.domain_mode is not None:
backend/app/api/chat.py:488:            domain_mode=body.domain_mode
backend/app/api/chat.py:670:            ChatSession.domain_mode,
backend/app/api/chat.py:678:        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
backend/app/api/chat.py:690:            domain_mode=getattr(row, 'domain_mode', None),
backend/app/api/collections.py:363:            ChatSession.domain_mode,
backend/app/api/collections.py:370:        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
backend/app/api/collections.py:382:                "domain_mode": row.domain_mode,
backend/app/api/extractions.py:187:    # P1 hygiene follow-up (2026-08-03): domain_mode ("legal"/"academic")
backend/app/api/extractions.py:194:    if body.domain_mode is not None:
backend/app/api/extractions.py:224:            "domain_mode": body.domain_mode,
backend/app/api/extractions.py:49:    domain_mode: Literal["legal", "academic"] | None = None
backend/app/models/tables.py:218:    domain_mode: Mapped[Optional[str]] = mapped_column(sa.String(20), nullable=True)
backend/app/schemas/chat.py:13:    domain_mode: Optional[Literal["legal", "academic"]] = None
backend/app/schemas/chat.py:56:    domain_mode: Optional[str] = None
backend/app/services/chat_service.py:1292:        domain_mode: Optional[str],
backend/app/services/chat_service.py:1312:                domain_mode=domain_mode,
backend/app/services/chat_service.py:1505:        domain_mode: Optional[str] = None,
backend/app/services/chat_service.py:1593:                domain_mode=domain_mode,
backend/app/services/chat_service.py:1604:            domain_mode=domain_mode,
backend/app/services/chat_service.py:2040:            # Frontend always sends domain_mode: null (default) or "legal"/"academic"
backend/app/services/chat_service.py:2041:            # domain_mode=None means Default (no extra rules), string means apply rules
backend/app/services/chat_service.py:2042:            if domain_mode:
backend/app/services/chat_service.py:2044:                domain_rules = DOMAIN_RULES.get(domain_mode)
backend/app/services/chat_service.py:2047:                    domain_rules_text = f"\n\n## {domain_mode.title()} Mode Rules\n"
backend/app/services/chat_service.py:2056:            # Persist domain_mode to session (null clears, string sets)
backend/app/services/chat_service.py:2057:            if domain_mode != session_obj.domain_mode:
backend/app/services/chat_service.py:2058:                session_obj.domain_mode = domain_mode
backend/app/services/chat_tool_executor.py:118:    domain_mode: str | None,
backend/app/services/chat_tool_executor.py:150:            "domain_mode": domain_mode,
backend/app/services/chat_tool_executor.py:416:        domain_mode: str | None,
backend/app/services/chat_tool_executor.py:473:                domain_mode=domain_mode,
backend/app/services/extraction_service.py:268:def _system_prompt(template: ExtractionTemplate, domain_mode: str | None) -> str:
backend/app/services/extraction_service.py:269:    domain = f"\nDomain mode: {domain_mode}." if domain_mode else ""
backend/app/services/extraction_service.py:290:def _call_llm(template: ExtractionTemplate, chunks: Sequence[tuple[Chunk, float]], locale: str | None, domain_mode: str | None) -> tuple[dict[str, Any], int, int]:
backend/app/services/extraction_service.py:293:        {"role": "system", "content": _system_prompt(template, domain_mode)},
backend/app/services/extraction_service.py:541:            domain_mode = (job.input_scope or {}).get("domain_mode")
backend/app/services/extraction_service.py:546:            raw, prompt_tokens, completion_tokens = _call_llm(template, chunks, locale, domain_mode)
backend/app/services/query_router.py:228:        domain_mode: str | None = None,
backend/app/services/query_router.py:347:        if domain_mode in {"legal", "academic"} and QueryIntent.EXISTENCE_CHECK in intents:

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '1266,1360p'
nl -ba backend/app/services/chat_service.py | sed -n '1480,1630p'
nl -ba backend/app/services/chat_service.py | sed -n '1990,2075p'
nl -ba backend/app/services/chat_service.py | sed -n '2532,2690p'
nl -ba backend/app/services/chat_service.py | sed -n '2690,2785p'
nl -ba backend/app/services/chat_tool_executor.py | sed -n '100,165p'
nl -ba backend/app/services/chat_tool_executor.py | sed -n '400,485p'
nl -ba backend/app/api/collections.py | sed -n '1,430p'
rg -n --glob '*.py' 'chat_stream\\(|continue_stream\\(|execute.*tool|create_extraction' backend/app | sort" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
  1266	class ChatService:
  1267	    async def _persist_user_message_and_title(
  1268	        self,
  1269	        *,
  1270	        db: AsyncSession,
  1271	        session_id: uuid.UUID,
  1272	        user_message: str,
  1273	    ) -> None:
  1274	        user_msg = Message(session_id=session_id, role="user", content=user_message)
  1275	        db.add(user_msg)
  1276	        await db.commit()
  1277	
  1278	        session = await db.get(ChatSession, session_id)
  1279	        if session and not session.title:
  1280	            clean = user_message.replace("\n", " ").replace("\r", "").strip()
  1281	            session.title = clean[:50]
  1282	            await db.commit()
  1283	
  1284	    async def _tool_action_stream(
  1285	        self,
  1286	        *,
  1287	        session_id: uuid.UUID,
  1288	        user_message: str,
  1289	        db: AsyncSession,
  1290	        user: Optional[User],
  1291	        locale: Optional[str],
  1292	        domain_mode: Optional[str],
  1293	        document_id: uuid.UUID | None,
  1294	        collection_doc_ids: list[uuid.UUID],
  1295	        action_plan: Any,
  1296	    ) -> AsyncGenerator[Dict[str, Any], None]:
  1297	        try:
  1298	            await self._persist_user_message_and_title(
  1299	                db=db,
  1300	                session_id=session_id,
  1301	                user_message=user_message,
  1302	            )
  1303	            if action_plan.user_visible_status:
  1304	                yield sse("tool_status", {"message": action_plan.user_visible_status})
  1305	            execution = await chat_tool_executor.execute(
  1306	                action_plan,
  1307	                user=user,
  1308	                db=db,
  1309	                document_id=document_id,
  1310	                collection_doc_ids=collection_doc_ids,
  1311	                locale=locale,
  1312	                domain_mode=domain_mode,
  1313	            )
  1314	            assistant_text = execution.message
  1315	            artifact_payload = execution.artifact.to_payload() if execution.artifact else None
  1316	            if artifact_payload:
  1317	                yield sse("artifact", artifact_payload)
  1318	            if assistant_text:
  1319	                yield sse("token", {"text": assistant_text})
  1320	
  1321	            asst_msg = Message(
  1322	                session_id=session_id,
  1323	                role="assistant",
  1324	                content=assistant_text,
  1325	                citations=(artifact_payload or {}).get("citations") if artifact_payload else None,
  1326	                metadata_json={
  1327	                    "action_plan": {
  1328	                        "action": action_plan.action.value,
  1329	                        "confidence": action_plan.confidence,
  1330	                        "reason": action_plan.reason,
  1331	                    },
  1332	                    "artifacts": [artifact_payload] if artifact_payload else [],
  1333	                },
  1334	            )
  1335	            db.add(asst_msg)
  1336	            await db.commit()
  1337	            yield sse(
  1338	                "done",
  1339	                {
  1340	                    "message_id": str(asst_msg.id),
  1341	                    "citations_count": 0,
  1342	                    "verification": None,
  1343	                    "can_continue": False,
  1344	                    "continuation_count": asst_msg.continuation_count,
  1345	                    "artifact_count": 1 if artifact_payload else 0,
  1346	                },
  1347	            )
  1348	        except Exception as exc:
  1349	            await db.rollback()
  1350	            yield _safe_sse("error", "CHAT_SETUP_ERROR", exc, session_id=str(session_id))
  1351	
  1352	    async def _run_verified_quote_search(
  1353	        self,
  1354	        *,
  1355	        session_id: uuid.UUID,
  1356	        db: AsyncSession,
  1357	        document: Document,
  1358	        user: User,
  1359	        topic: str,
  1360	        locale: Optional[str],
  1480	            prompt_tokens=progress.prompt_tokens,
  1481	            completion_tokens=progress.completion_tokens,
  1482	            cost_credits=actual_cost,
  1483	        )
  1484	        await db.commit()
  1485	        # Only trustworthy once the atomic commit's await has ACTUALLY
  1486	        # returned — the ordinary-exception handler (FIX-4) uses this to
  1487	        # know whether a real answer was delivered.
  1488	        progress.message_id = message_id
  1489	
  1490	        return _VerifiedQuoteOutcome(
  1491	            message_id=message_id,
  1492	            assistant_text=assistant_text,
  1493	            citations=citations,
  1494	            artifact_payload=artifact_payload,
  1495	        )
  1496	
  1497	    async def chat_stream(
  1498	        self,
  1499	        session_id: uuid.UUID,
  1500	        user_message: str,
  1501	        db: AsyncSession,
  1502	        user: Optional[User] = None,
  1503	        locale: Optional[str] = None,
  1504	        mode: Optional[str] = None,
  1505	        domain_mode: Optional[str] = None,
  1506	    ) -> AsyncGenerator[Dict[str, Any], None]:
  1507	        """Main chat streaming generator producing SSE event dicts.
  1508	
  1509	        Steps per spec:
  1510	        1) Load session + document
  1511	        2) Save user message
  1512	        3) Load recent history (last MAX_CHAT_HISTORY_TURNS rounds)
  1513	        4) Retrieval top-5
  1514	        5) Build prompt with numbered chunks
  1515	        6) Stream Anthropic
  1516	        7) Parse with RefParserFSM and yield events; ping every 15s
  1517	        8) Save assistant message + citations
  1518	        9) Yield done
  1519	        """
  1520	
  1521	        # 1) Load session
  1522	        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
  1523	        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
  1524	        if not session_obj:
  1525	            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "会话不存在"})
  1526	            return
  1527	
  1528	        document_id = session_obj.document_id
  1529	        collection_id = getattr(session_obj, "collection_id", None)
  1530	        is_collection_session = collection_id is not None and document_id is None
  1531	
  1532	        # Load document for custom instructions (single-doc sessions)
  1533	        doc = await db.get(Document, document_id) if document_id else None
  1534	
  1535	        # For collection sessions, load all document IDs and filenames
  1536	        collection_doc_ids: List[uuid.UUID] = []
  1537	        collection_doc_names: dict[uuid.UUID, str] = {}
  1538	        collection_doc_types: dict[uuid.UUID, str] = {}
  1539	        collection_doc_pages: dict[uuid.UUID, int] = {}
  1540	        if is_collection_session:
  1541	            cd_rows = await db.execute(
  1542	                select(collection_documents.c.document_id).where(
  1543	                    collection_documents.c.collection_id == collection_id
  1544	                )
  1545	            )
  1546	            collection_doc_ids = [row[0] for row in cd_rows.all()]
  1547	            if collection_doc_ids:
  1548	                doc_rows = await db.execute(
  1549	                    select(Document.id, Document.filename, Document.file_type, Document.page_count)
  1550	                    .where(Document.id.in_(collection_doc_ids))
  1551	                )
  1552	                for drow in doc_rows.all():
  1553	                    collection_doc_names[drow[0]] = drow[1]
  1554	                    collection_doc_types[drow[0]] = drow[2]
  1555	                    if drow[3]:
  1556	                        collection_doc_pages[drow[0]] = drow[3]
  1557	
  1558	        # Resolve mode → model (mode is the ONLY way to select a model)
  1559	        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
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
  1990	            elif retrieval_strategy == "document_summary_context":
  1991	                map_reduce_rule = (
  1992	                    "7. The sources may be map-reduce section summaries generated from source chunks; "
  1993	                    "use the coverage status to distinguish model-covered, fallback, and missing sections.\n"
  1994	                    if has_map_reduce_summary_context
  1995	                    else ""
  1996	                )
  1997	                system_prompt = (
  1998	                    "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
  1999	                    + SYSTEM_PROMPT_META_RULE
  2000	                    + "## Document Coverage Sources\n"
  2001	                    + (
  2002	                        "\n".join(numbered_chunks)
  2003	                        if numbered_chunks
  2004	                        else "(none)"
  2005	                    )
  2006	                    + "\n\n## Summary Rules\n"
  2007	                    + "1. Treat these sources as representative coverage selected across the document, not as semantic search results for a narrow question.\n"
  2008	                    + "2. Do NOT say the user's ready document is not a complete document merely because the context is selective.\n"
  2009	                    + "3. Produce a useful document-level summary with clear headings, key points, and important caveats when supported.\n"
  2010	                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
  2011	                    + "5. Cite every factual paragraph or bullet using the source numbers listed above.\n"
  2012	                    + "6. Your response language MUST match the language of the user's question.\n"
  2013	                    + map_reduce_rule
  2014	                    + _summary_coverage_contract(retrieved)
  2015	                    + _citation_contract()
  2016	                )
  2017	            else:
  2018	                system_prompt = (
  2019	                    "You are a document analysis assistant. Answer the user's question based on the following document sources.\n\n"
  2020	                    + SYSTEM_PROMPT_META_RULE
  2021	                    + "## Document Sources\n"
  2022	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2023	                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
  2024	                    + _query_plan_contract(retrieval_plan)
  2025	                    + "\n\n## Rules\n" + rules
  2026	                    + _citation_contract()
  2027	                )
  2028	
  2029	            # Inject custom instructions if present (subordinate to core rules — they are
  2030	            # user preferences, not overrides of role/source/citation/safety rules).
  2031	            if doc and doc.custom_instructions:
  2032	                system_prompt += (
  2033	                    "\n## Custom Instructions\n"
  2034	                    "Follow these custom instructions only when they do not conflict with the role, "
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
  2532	    async def continue_stream(
  2533	        self,
  2534	        session_id: uuid.UUID,
  2535	        message_id: Optional[uuid.UUID],
  2536	        db: AsyncSession,
  2537	        user: Optional[User] = None,
  2538	        locale: Optional[str] = None,
  2539	        mode: Optional[str] = None,
  2540	    ) -> AsyncGenerator[Dict[str, Any], None]:
  2541	        """Continue a truncated assistant response, appending to the existing message."""
  2542	
  2543	        # 1) Load session
  2544	        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
  2545	        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
  2546	        if not session_obj:
  2547	            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "Session not found"})
  2548	            return
  2549	
  2550	        document_id = session_obj.document_id
  2551	        collection_id = getattr(session_obj, "collection_id", None)
  2552	        is_collection_session = collection_id is not None and document_id is None
  2553	
  2554	        doc = await db.get(Document, document_id) if document_id else None
  2555	
  2556	        # For collection sessions, load document names
  2557	        collection_doc_names: dict[uuid.UUID, str] = {}
  2558	        collection_doc_types: dict[uuid.UUID, str] = {}
  2559	        collection_doc_pages: dict[uuid.UUID, int] = {}
  2560	        if is_collection_session:
  2561	            from app.models.tables import collection_documents as cd_table
  2562	            cd_rows = await db.execute(
  2563	                select(cd_table.c.document_id).where(cd_table.c.collection_id == collection_id)
  2564	            )
  2565	            collection_doc_ids = [r[0] for r in cd_rows.all()]
  2566	            if collection_doc_ids:
  2567	                doc_rows = await db.execute(
  2568	                    select(Document.id, Document.filename, Document.file_type, Document.page_count)
  2569	                    .where(Document.id.in_(collection_doc_ids))
  2570	                )
  2571	                for drow in doc_rows.all():
  2572	                    collection_doc_names[drow[0]] = drow[1]
  2573	                    collection_doc_types[drow[0]] = drow[2]
  2574	                    if drow[3]:
  2575	                        collection_doc_pages[drow[0]] = drow[3]
  2576	
  2577	        # 2) Load assistant message to continue
  2578	        if message_id:
  2579	            asst_msg = await db.get(Message, message_id)
  2580	        else:
  2581	            # Fall back to most recent assistant message in session
  2582	            result = await db.execute(
  2583	                select(Message)
  2584	                .where(Message.session_id == session_id, Message.role == "assistant")
  2585	                .order_by(Message.created_at.desc())
  2586	                .limit(1)
  2587	            )
  2588	            asst_msg = result.scalar_one_or_none()
  2589	
  2590	        if not asst_msg or asst_msg.role != "assistant":
  2591	            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Assistant message not found"})
  2592	            return
  2593	
  2594	        if asst_msg.session_id != session_id:
  2595	            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Message does not belong to this session"})
  2596	            return
  2597	
  2598	        # 3) Check continuation limit
  2599	        if asst_msg.continuation_count >= settings.MAX_CONTINUATIONS_PER_MESSAGE:
  2600	            yield sse("error", {"code": "CONTINUATION_LIMIT", "message": "Maximum continuations reached"})
  2601	            return
  2602	
  2603	        # 4) Resolve mode → model
  2604	        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
  2605	        effective_model = settings.MODE_MODELS[effective_mode]
  2606	
  2607	        if user is None and doc and doc.demo_slug:
  2608	            effective_model = settings.DEMO_LLM_MODEL
  2609	            effective_mode = "quick"
  2610	
  2611	        if effective_mode in settings.PREMIUM_MODES:
  2612	            user_plan = (user.plan or "free").lower() if user else "free"
  2613	            if user_plan == "free":
  2614	                yield sse(
  2615	                    "error",
  2616	                    {
  2617	                        "code": "MODE_NOT_ALLOWED",
  2618	                        "message": "Upgrade to Plus to use this mode",
  2619	                        "required_plan": "plus",
  2620	                    },
  2621	                )
  2622	                return
  2623	
  2624	        # 5) Pre-debit credits
  2625	        pre_debited = 0
  2626	        predebit_ledger_id = None
  2627	        if user is not None:
  2628	            estimated = credit_service.get_estimated_cost(effective_mode)
  2629	            predebit_ledger_id = await credit_service.debit_credits(
  2630	                db, user_id=user.id, cost=estimated,
  2631	                reason="chat", ref_type="mode", ref_id=effective_mode,
  2632	            )
  2633	            if predebit_ledger_id:
  2634	                pre_debited = estimated
  2635	                await db.commit()
  2636	            else:
  2637	                balance = await credit_service.get_user_credits(db, user.id)
  2638	                yield sse("error", {
  2639	                    "code": "INSUFFICIENT_CREDITS",
  2640	                    "message": "Insufficient credits",
  2641	                    "required": estimated,
  2642	                    "balance": balance,
  2643	                })
  2644	                return
  2645	
  2646	        settled = False
  2647	        try:
  2648	            # 6) Reconstruct chunk_map from original citations
  2649	            chunk_map: dict[int, _ChunkInfo] = {}
  2650	            original_citations = asst_msg.citations or []
  2651	            if original_citations:
  2652	                chunk_ids_set: set[str] = set()
  2653	                ref_to_chunk_id: dict[int, str] = {}
  2654	                ref_to_citation: dict[int, dict] = {}
  2655	                table_ids_set: set[str] = set()
  2656	                for cit in original_citations:
  2657	                    if not isinstance(cit, dict):
  2658	                        continue
  2659	                    cid = cit.get("chunk_id")
  2660	                    ref = cit.get("ref_index")
  2661	                    if cid and ref is not None:
  2662	                        try:
  2663	                            normalized_ref = int(ref)
  2664	                            normalized_cid = str(uuid.UUID(str(cid)))
  2665	                        except Exception:
  2666	                            continue
  2667	                        chunk_ids_set.add(normalized_cid)
  2668	                        ref_to_chunk_id[normalized_ref] = normalized_cid
  2669	                        ref_to_citation[normalized_ref] = cit
  2670	                        table_id = cit.get("table_id")
  2671	                        if table_id:
  2672	                            try:
  2673	                                table_ids_set.add(str(uuid.UUID(str(table_id))))
  2674	                            except Exception:
  2675	                                pass
  2676	
  2677	                if chunk_ids_set:
  2678	                    chunk_uuids = [uuid.UUID(c) for c in chunk_ids_set]
  2679	                    chunk_rows = await db.execute(
  2680	                        select(Chunk).where(Chunk.id.in_(chunk_uuids))
  2681	                    )
  2682	                    chunks_by_id: dict[str, Chunk] = {}
  2683	                    for ch in chunk_rows.scalars():
  2684	                        chunks_by_id[str(ch.id)] = ch
  2685	
  2686	                    tables_by_id: dict[str, DocumentTable] = {}
  2687	                    if table_ids_set:
  2688	                        table_uuids = [uuid.UUID(tid) for tid in table_ids_set]
  2689	                        table_rows = await db.execute(
  2690	                            select(DocumentTable).where(DocumentTable.id.in_(table_uuids))
  2690	                            select(DocumentTable).where(DocumentTable.id.in_(table_uuids))
  2691	                        )
  2692	                        for table in table_rows.scalars():
  2693	                            tables_by_id[str(table.id)] = table
  2694	
  2695	                    for ref_num, cid in ref_to_chunk_id.items():
  2696	                        ch = chunks_by_id.get(cid)
  2697	                        if ch:
  2698	                            citation = dict(ref_to_citation.get(ref_num) or {})
  2699	                            table_id = citation.get("table_id")
  2700	                            if table_id and not citation.get("table_context"):
  2701	                                table = tables_by_id.get(str(table_id))
  2702	                                if table:
  2703	                                    citation["table_context"] = table_evidence_text(table)
  2704	                                    citation["page"] = table.page
  2705	                                    citation["page_end"] = table.page
  2706	                            chunk_map[ref_num] = _chunk_info_from_persisted_citation(
  2707	                                ch,
  2708	                                citation,
  2709	                                collection_doc_names,
  2710	                            )
  2711	
  2712	            # 7) Load conversation history
  2713	            max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
  2714	            max_msgs = max_turns * 2
  2715	            msgs_row = await db.execute(
  2716	                select(Message)
  2717	                .where(Message.session_id == session_id)
  2718	                .order_by(Message.created_at.desc())
  2719	                .limit(max_msgs + 1)
  2720	            )
  2721	            history_msgs: List[Message] = list(msgs_row.scalars().all())
  2722	            history_msgs.reverse()
  2723	
  2724	            claude_messages: List[dict] = []
  2725	            for m in history_msgs:
  2726	                claude_messages.append({"role": m.role, "content": m.content})
  2727	
  2728	            # Add continuation prompt
  2729	            claude_messages.append({
  2730	                "role": "user",
  2731	                "content": _continuation_prompt(locale, asst_msg.content),
  2732	            })
  2733	
  2734	            # 8) Build system prompt with chunk_map context
  2735	            numbered_chunks: List[str] = []
  2736	            for idx in sorted(chunk_map.keys()):
  2737	                info = chunk_map[idx]
  2738	                text = (info.text or "")[:1400]
  2739	                doc_label = ""
  2740	                if is_collection_session and info.document_id:
  2741	                    fname = collection_doc_names.get(info.document_id, "")
  2742	                    if fname:
  2743	                        doc_label = f"(from: {fname}) "
  2744	                    chunk_ft = collection_doc_types.get(info.document_id)
  2745	                    chunk_pages = collection_doc_pages.get(info.document_id)
  2746	                else:
  2747	                    chunk_ft = getattr(doc, "file_type", None)
  2748	                    chunk_pages = getattr(doc, "page_count", None)
  2749	                src = _source_locator(
  2750	                    {
  2751	                        "page": info.page_start,
  2752	                        "page_end": info.page_end,
  2753	                        "section_title": info.section_title,
  2754	                        "retrieval_modality": info.retrieval_modality,
  2755	                    },
  2756	                    chunk_ft,
  2757	                    chunk_pages,
  2758	                )
  2759	                src_label = f"({src}) " if src else ""
  2760	                numbered_chunks.append(f"[{idx}] {doc_label}{src_label}{text}")
  2761	
  2762	            rules = get_rules_for_model(
  2763	                effective_model, is_collection=is_collection_session
  2764	            )
  2765	
  2766	            if is_collection_session:
  2767	                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
  2768	                system_prompt = (
  2769	                    "You are a document analysis assistant. Answer the user's question based on sources from multiple documents.\n\n"
  2770	                    + SYSTEM_PROMPT_META_RULE
  2771	                    + f"## Available Documents\n{doc_list}\n\n"
  2772	                    + "## Document Sources\n"
  2773	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2774	                    + "\n\n## Rules\n" + rules
  2775	                    + _citation_contract()
  2776	                )
  2777	            else:
  2778	                system_prompt = (
  2779	                    "You are a document analysis assistant. Answer the user's question based on the following document sources.\n\n"
  2780	                    + SYSTEM_PROMPT_META_RULE
  2781	                    + "## Document Sources\n"
  2782	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2783	                    + "\n\n## Rules\n" + rules
  2784	                    + _citation_contract()
  2785	                )
   100	    used = await db.scalar(
   101	        select(func.count())
   102	        .select_from(DocumentJob)
   103	        .where(DocumentJob.user_id == user.id)
   104	        .where(DocumentJob.job_type == EXTRACTION_JOB_TYPE)
   105	        .where(DocumentJob.status.in_(["queued", "running", "succeeded"]))
   106	        .where(DocumentJob.created_at >= window_start)
   107	    )
   108	    return int(used or 0) < FREE_MONTHLY_EXTRACTION_LIMIT
   109	
   110	
   111	async def _queue_extraction(
   112	    *,
   113	    user: User,
   114	    db: AsyncSession,
   115	    doc: Document,
   116	    plan: ActionPlan,
   117	    locale: str | None,
   118	    domain_mode: str | None,
   119	) -> ToolExecution:
   120	    template_key = plan.template_key or "executive_summary"
   121	    try:
   122	        template = get_template(template_key)
   123	    except ValueError:
   124	        template = get_template("executive_summary")
   125	
   126	    if not await _enforce_free_extraction_limit(user, db):
   127	        return ToolExecution(
   128	            message=_copy(
   129	                plan,
   130	                en="You have used the free structured extraction allowance. Upgrade to continue creating cited deliverables.",
   131	                zh="你已经用完免费结构化提取额度。升级后可以继续生成带引用的交付物。",
   132	            ),
   133	            artifact=ChatArtifact(
   134	                artifact_type="extraction",
   135	                status="failed",
   136	                title=template.title,
   137	                summary="Structured extraction limit reached.",
   138	                required_plan="plus",
   139	            ),
   140	        )
   141	
   142	    job = DocumentJob(
   143	        user_id=user.id,
   144	        document_id=doc.id,
   145	        job_type=EXTRACTION_JOB_TYPE,
   146	        status="queued",
   147	        input_scope={
   148	            "template_key": template.key,
   149	            "locale": locale,
   150	            "domain_mode": domain_mode,
   151	            "source": "chat",
   152	        },
   153	    )
   154	    db.add(job)
   155	    await db.flush()
   156	    ledger_id = await credit_service.debit_credits(
   157	        db,
   158	        user_id=user.id,
   159	        cost=EXTRACTION_PREDEBIT_CREDITS,
   160	        reason="extraction",
   161	        ref_type="document_job",
   162	        ref_id=str(job.id),
   163	    )
   164	    if ledger_id is None:
   165	        await db.rollback()
   400	            zh="我已开始扫描文档表格。完成后结果会在这里更新。",
   401	        ),
   402	        artifact=artifact,
   403	    )
   404	
   405	
   406	class ChatToolExecutor:
   407	    async def execute(
   408	        self,
   409	        plan: ActionPlan,
   410	        *,
   411	        user: User | None,
   412	        db: AsyncSession,
   413	        document_id: uuid.UUID | None,
   414	        collection_doc_ids: list[uuid.UUID],
   415	        locale: str | None,
   416	        domain_mode: str | None,
   417	    ) -> ToolExecution:
   418	        if user is None:
   419	            return ToolExecution(
   420	                message="Please sign in to create exports, structured extractions, templates, or document comparisons.",
   421	                artifact=None,
   422	            )
   423	
   424	        if plan.action in {ChatAction.CREATE_QUESTION_TEMPLATE, ChatAction.RUN_QUESTION_TEMPLATE}:
   425	            return ToolExecution(
   426	                message=plan.user_visible_status
   427	                or "Send the checklist questions in chat, one per line, and I can turn them into a reusable template.",
   428	                artifact=None,
   429	            )
   430	
   431	        if plan.action == ChatAction.COMPARE_DOCUMENTS:
   432	            if len(plan.document_ids) >= 2:
   433	                return ToolExecution(
   434	                    message="Document comparison from chat is ready to route, but I need the selected old/new document ids confirmed before spending Pro credits.",
   435	                    artifact=None,
   436	                )
   437	            if collection_doc_ids:
   438	                count = len(collection_doc_ids)
   439	                return ToolExecution(
   440	                    message=f"I found {count} document(s) in this collection. Tell me which two versions to compare, for example: compare A.pdf with B.pdf.",
   441	                    artifact=None,
   442	                )
   443	            return ToolExecution(
   444	                message=plan.user_visible_status
   445	                or "Please upload or choose the old version and the new version before I run a cited comparison.",
   446	                artifact=None,
   447	            )
   448	
   449	        if document_id is None:
   450	            return ToolExecution(
   451	                message="This action needs a single active document. Open a document and ask again.",
   452	                artifact=None,
   453	            )
   454	        doc = await _verify_document(document_id, user, db)
   455	        if not doc:
   456	            return ToolExecution(
   457	                message="I could not access that document.",
   458	                artifact=None,
   459	            )
   460	        if doc.status != "ready":
   461	            return ToolExecution(
   462	                message="The document is still processing. Try again when it is ready.",
   463	                artifact=None,
   464	            )
   465	
   466	        if plan.action == ChatAction.EXTRACT_DELIVERABLE:
   467	            return await _queue_extraction(
   468	                user=user,
   469	                db=db,
   470	                doc=doc,
   471	                plan=plan,
   472	                locale=locale,
   473	                domain_mode=domain_mode,
   474	            )
   475	        if plan.action in {ChatAction.SCAN_TABLES, ChatAction.EXPORT_TABLES}:
   476	            return await _queue_table_scan(
   477	                user=user,
   478	                db=db,
   479	                doc=doc,
   480	                export_requested=plan.action == ChatAction.EXPORT_TABLES,
   481	                plan=plan,
   482	            )
   483	
   484	        return ToolExecution(
   485	            message="I can answer that directly in chat.",
     1	from __future__ import annotations
     2	
     3	import uuid
     4	from typing import Optional
     5	
     6	from fastapi import APIRouter, Depends, HTTPException, Query, status
     7	from pydantic import BaseModel, Field
     8	from sqlalchemy import func, select
     9	from sqlalchemy.ext.asyncio import AsyncSession
    10	from sqlalchemy.orm import selectinload
    11	
    12	from app.core.config import settings
    13	from app.core.deps import get_db_session, require_auth
    14	from app.models.tables import (
    15	    ChatSession,
    16	    Collection,
    17	    Document,
    18	    Message,
    19	    User,
    20	    collection_documents,
    21	)
    22	
    23	collections_router = APIRouter(prefix="/api/collections", tags=["collections"])
    24	
    25	COLLECTION_NOT_FOUND_DETAIL = {
    26	    "error": "COLLECTION_NOT_FOUND",
    27	    "message": "Collection not found",
    28	}
    29	
    30	
    31	# --- Schemas ---
    32	
    33	class CreateCollectionRequest(BaseModel):
    34	    name: str = Field(..., min_length=1, max_length=200)
    35	    description: Optional[str] = Field(None, max_length=2000)
    36	    document_ids: Optional[list[str]] = None
    37	
    38	
    39	class AddDocumentsRequest(BaseModel):
    40	    document_ids: list[str]
    41	
    42	
    43	class CollectionBrief(BaseModel):
    44	    id: str
    45	    name: str
    46	    description: Optional[str] = None
    47	    document_count: int
    48	    created_at: str
    49	
    50	    class Config:
    51	        from_attributes = True
    52	
    53	
    54	class CollectionDocumentBrief(BaseModel):
    55	    id: str
    56	    filename: str
    57	    status: str
    58	    file_type: Optional[str] = "pdf"
    59	
    60	
    61	class CollectionDetail(BaseModel):
    62	    id: str
    63	    name: str
    64	    description: Optional[str] = None
    65	    documents: list[CollectionDocumentBrief]
    66	    created_at: str
    67	    updated_at: str
    68	
    69	
    70	# --- Endpoints ---
    71	
    72	@collections_router.get("")
    73	async def list_collections(
    74	    limit: Optional[int] = Query(None, ge=1, le=100),
    75	    offset: int = Query(0, ge=0),
    76	    user: User = Depends(require_auth),
    77	    db: AsyncSession = Depends(get_db_session),
    78	):
    79	    """List user collections with document counts."""
    80	    stmt = (
    81	        select(
    82	            Collection.id,
    83	            Collection.name,
    84	            Collection.description,
    85	            Collection.created_at,
    86	            func.count(collection_documents.c.document_id).label("document_count"),
    87	        )
    88	        .outerjoin(collection_documents, collection_documents.c.collection_id == Collection.id)
    89	        .where(Collection.user_id == user.id)
    90	        .group_by(Collection.id)
    91	        .order_by(Collection.updated_at.desc())
    92	    )
    93	    if limit is not None:
    94	        stmt = stmt.limit(limit)
    95	    stmt = stmt.offset(offset)
    96	    result = await db.execute(stmt)
    97	    rows = result.all()
    98	    return [
    99	        CollectionBrief(
   100	            id=str(row.id),
   101	            name=row.name,
   102	            description=row.description,
   103	            document_count=row.document_count,
   104	            created_at=row.created_at.isoformat(),
   105	        )
   106	        for row in rows
   107	    ]
   108	
   109	
   110	@collections_router.post("", status_code=status.HTTP_201_CREATED)
   111	async def create_collection(
   112	    body: CreateCollectionRequest,
   113	    user: User = Depends(require_auth),
   114	    db: AsyncSession = Depends(get_db_session),
   115	):
   116	    """Create a new collection with optional initial document_ids."""
   117	    # Plan limit: max collections
   118	    plan = (user.plan or "free").lower()
   119	    max_collections = {
   120	        "free": settings.FREE_MAX_COLLECTIONS,
   121	        "plus": settings.PLUS_MAX_COLLECTIONS,
   122	        "pro": settings.PRO_MAX_COLLECTIONS,
   123	    }.get(plan, settings.FREE_MAX_COLLECTIONS)
   124	    count_result = await db.execute(
   125	        select(func.count()).select_from(Collection).where(Collection.user_id == user.id)
   126	    )
   127	    current_count = count_result.scalar() or 0
   128	    if current_count >= max_collections:
   129	        raise HTTPException(
   130	            status_code=403,
   131	            detail={
   132	                "error": "COLLECTION_LIMIT_REACHED",
   133	                "message": f"Your plan allows up to {max_collections} collections. Upgrade for more.",
   134	                "limit": max_collections,
   135	                "plan": plan,
   136	            },
   137	        )
   138	
   139	    coll = Collection(
   140	        name=body.name,
   141	        description=body.description,
   142	        user_id=user.id,
   143	    )
   144	    db.add(coll)
   145	    await db.flush()
   146	
   147	    # Add initial documents if provided
   148	    if body.document_ids:
   149	        for did_str in body.document_ids:
   150	            try:
   151	                did = uuid.UUID(did_str)
   152	            except ValueError:
   153	                continue
   154	            doc = await db.get(Document, did)
   155	            if doc and doc.user_id == user.id:
   156	                await db.execute(
   157	                    collection_documents.insert().values(
   158	                        collection_id=coll.id, document_id=did
   159	                    )
   160	                )
   161	
   162	    await db.commit()
   163	    await db.refresh(coll)
   164	    return {
   165	        "id": str(coll.id),
   166	        "name": coll.name,
   167	        "created_at": coll.created_at.isoformat(),
   168	    }
   169	
   170	
   171	@collections_router.get("/{collection_id}")
   172	async def get_collection(
   173	    collection_id: uuid.UUID,
   174	    user: User = Depends(require_auth),
   175	    db: AsyncSession = Depends(get_db_session),
   176	):
   177	    """Get collection detail with documents list."""
   178	    result = await db.execute(
   179	        select(Collection)
   180	        .options(selectinload(Collection.documents))
   181	        .where(Collection.id == collection_id, Collection.user_id == user.id)
   182	    )
   183	    coll = result.scalar_one_or_none()
   184	    if not coll:
   185	        raise HTTPException(status_code=404, detail=COLLECTION_NOT_FOUND_DETAIL)
   186	
   187	    docs = [
   188	        CollectionDocumentBrief(
   189	            id=str(d.id),
   190	            filename=d.filename,
   191	            status=d.status,
   192	            file_type=getattr(d, "file_type", "pdf"),
   193	        )
   194	        for d in coll.documents
   195	    ]
   196	    return CollectionDetail(
   197	        id=str(coll.id),
   198	        name=coll.name,
   199	        description=coll.description,
   200	        documents=docs,
   201	        created_at=coll.created_at.isoformat(),
   202	        updated_at=coll.updated_at.isoformat(),
   203	    )
   204	
   205	
   206	@collections_router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
   207	async def delete_collection(
   208	    collection_id: uuid.UUID,
   209	    user: User = Depends(require_auth),
   210	    db: AsyncSession = Depends(get_db_session),
   211	):
   212	    """Delete collection (cascade sessions, keep documents)."""
   213	    coll = await db.get(Collection, collection_id)
   214	    if not coll or coll.user_id != user.id:
   215	        raise HTTPException(status_code=404, detail=COLLECTION_NOT_FOUND_DETAIL)
   216	    await db.delete(coll)
   217	    await db.commit()
   218	    return None
   219	
   220	
   221	@collections_router.post("/{collection_id}/documents", status_code=status.HTTP_201_CREATED)
   222	async def add_documents_to_collection(
   223	    collection_id: uuid.UUID,
   224	    body: AddDocumentsRequest,
   225	    user: User = Depends(require_auth),
   226	    db: AsyncSession = Depends(get_db_session),
   227	):
   228	    """Add documents to a collection."""
   229	    coll = await db.get(Collection, collection_id)
   230	    if not coll or coll.user_id != user.id:
   231	        raise HTTPException(status_code=404, detail=COLLECTION_NOT_FOUND_DETAIL)
   232	
   233	    # Plan limit: max docs per collection
   234	    plan = (user.plan or "free").lower()
   235	    max_docs = {
   236	        "free": settings.FREE_MAX_DOCS_PER_COLLECTION,
   237	        "plus": settings.PLUS_MAX_DOCS_PER_COLLECTION,
   238	        "pro": settings.PRO_MAX_DOCS_PER_COLLECTION,
   239	    }.get(plan, settings.FREE_MAX_DOCS_PER_COLLECTION)
   240	    doc_count_result = await db.execute(
   241	        select(func.count())
   242	        .select_from(collection_documents)
   243	        .where(collection_documents.c.collection_id == collection_id)
   244	    )
   245	    current_docs = doc_count_result.scalar() or 0
   246	
   247	    # Pre-filter: collect valid, non-duplicate doc IDs
   248	    seen_ids: set[uuid.UUID] = set()
   249	    valid_doc_ids = []
   250	    for did_str in body.document_ids:
   251	        try:
   252	            did = uuid.UUID(did_str)
   253	        except ValueError:
   254	            continue
   255	        if did in seen_ids:
   256	            continue
   257	        seen_ids.add(did)
   258	        doc = await db.get(Document, did)
   259	        if not doc or doc.user_id != user.id:
   260	            continue
   261	        existing = await db.execute(
   262	            select(collection_documents)
   263	            .where(
   264	                collection_documents.c.collection_id == collection_id,
   265	                collection_documents.c.document_id == did,
   266	            )
   267	        )
   268	        if existing.first():
   269	            continue
   270	        valid_doc_ids.append(did)
   271	
   272	    # Check limit against actual addable count
   273	    if current_docs + len(valid_doc_ids) > max_docs:
   274	        raise HTTPException(
   275	            status_code=403,
   276	            detail={
   277	                "error": "COLLECTION_DOC_LIMIT_REACHED",
   278	                "message": f"Your plan allows up to {max_docs} documents per collection. Upgrade for more.",
   279	                "limit": max_docs,
   280	                "plan": plan,
   281	            },
   282	        )
   283	
   284	    added = 0
   285	    for did in valid_doc_ids:
   286	        await db.execute(
   287	            collection_documents.insert().values(
   288	                collection_id=collection_id, document_id=did
   289	            )
   290	        )
   291	        added += 1
   292	
   293	    await db.commit()
   294	    return {"added": added}
   295	
   296	
   297	@collections_router.delete("/{collection_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
   298	async def remove_document_from_collection(
   299	    collection_id: uuid.UUID,
   300	    document_id: uuid.UUID,
   301	    user: User = Depends(require_auth),
   302	    db: AsyncSession = Depends(get_db_session),
   303	):
   304	    """Remove a document from a collection."""
   305	    coll = await db.get(Collection, collection_id)
   306	    if not coll or coll.user_id != user.id:
   307	        raise HTTPException(status_code=404, detail=COLLECTION_NOT_FOUND_DETAIL)
   308	
   309	    await db.execute(
   310	        collection_documents.delete().where(
   311	            collection_documents.c.collection_id == collection_id,
   312	            collection_documents.c.document_id == document_id,
   313	        )
   314	    )
   315	    await db.commit()
   316	    return None
   317	
   318	
   319	@collections_router.post("/{collection_id}/sessions", status_code=status.HTTP_201_CREATED)
   320	async def create_collection_session(
   321	    collection_id: uuid.UUID,
   322	    user: User = Depends(require_auth),
   323	    db: AsyncSession = Depends(get_db_session),
   324	):
   325	    """Create a chat session for a collection (cross-document Q&A)."""
   326	    coll = await db.get(Collection, collection_id)
   327	    if not coll or coll.user_id != user.id:
   328	        raise HTTPException(status_code=404, detail=COLLECTION_NOT_FOUND_DETAIL)
   329	
   330	    sess = ChatSession(collection_id=collection_id, user_id=user.id)
   331	    db.add(sess)
   332	    await db.commit()
   333	    await db.refresh(sess)
   334	    return {
   335	        "session_id": str(sess.id),
   336	        "collection_id": str(collection_id),
   337	        "title": sess.title,
   338	        "created_at": sess.created_at.isoformat(),
   339	    }
   340	
   341	
   342	@collections_router.get("/{collection_id}/sessions")
   343	async def list_collection_sessions(
   344	    collection_id: uuid.UUID,
   345	    user: User = Depends(require_auth),
   346	    db: AsyncSession = Depends(get_db_session),
   347	):
   348	    """List sessions for a collection."""
   349	    coll = await db.get(Collection, collection_id)
   350	    if not coll or coll.user_id != user.id:
   351	        raise HTTPException(status_code=404, detail=COLLECTION_NOT_FOUND_DETAIL)
   352	
   353	    from sqlalchemy import desc
   354	
   355	    last_activity = func.coalesce(
   356	        func.max(Message.created_at), ChatSession.created_at
   357	    ).label("last_activity_at")
   358	
   359	    stmt = (
   360	        select(
   361	            ChatSession.id,
   362	            ChatSession.title,
   363	            ChatSession.domain_mode,
   364	            ChatSession.created_at,
   365	            func.count(Message.id).label("message_count"),
   366	            last_activity,
   367	        )
   368	        .outerjoin(Message, Message.session_id == ChatSession.id)
   369	        .where(ChatSession.collection_id == collection_id)
   370	        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
   371	        .order_by(desc(last_activity))
   372	        .limit(10)
   373	    )
   374	    result = await db.execute(stmt)
   375	    rows = result.all()
   376	    return {
   377	        "sessions": [
   378	            {
   379	                "session_id": str(row.id),
   380	                "title": row.title,
   381	                "message_count": row.message_count,
   382	                "domain_mode": row.domain_mode,
   383	                "created_at": row.created_at.isoformat(),
   384	                "last_activity_at": row.last_activity_at.isoformat() if row.last_activity_at else row.created_at.isoformat(),
   385	            }
   386	            for row in rows
   387	        ]
   388	    }
backend/app/api/chat.py:368:async def chat_stream(
backend/app/api/chat.py:486:        async for ev in chat_service.chat_stream(
backend/app/api/chat.py:623:        async for ev in chat_service.continue_stream(
backend/app/api/extractions.py:174:async def create_extraction(
backend/app/services/chat_service.py:1497:    async def chat_stream(
backend/app/services/chat_service.py:2532:    async def continue_stream(

exec
/bin/zsh -lc "nl -ba backend/app/services/chat_service.py | sed -n '1570,1810p'
nl -ba backend/app/services/chat_service.py | sed -n '1810,2000p'
nl -ba backend/app/services/chat_service.py | sed -n '2530,2710p'
nl -ba backend/app/services/chat_service.py | sed -n '2710,2870p'
nl -ba backend/app/workers/extraction_worker.py | sed -n '1,220p'
nl -ba backend/app/services/chat_tool_executor.py | sed -n '70,190p'
rg -n --glob '*.{py,ts,tsx}' 'domainMode|domain_mode' frontend/src | sort" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
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
  1636	                balance = await credit_service.get_user_credits(db, user.id)
  1637	                yield sse(
  1638	                    "error",
  1639	                    {
  1640	                        "code": "INSUFFICIENT_CREDITS",
  1641	                        "message": "Insufficient credits to start chat",
  1642	                        "required": estimated,
  1643	                        "balance": balance,
  1644	                    },
  1645	                )
  1646	                return
  1647	
  1648	        settled = False
  1649	        setup_error_code = "CHAT_SETUP_ERROR"
  1650	        try:
  1651	            # 2) Save user message
  1652	            await self._persist_user_message_and_title(
  1653	                db=db,
  1654	                session_id=session_id,
  1655	                user_message=user_message,
  1656	            )
  1657	
  1658	            # Strict verbatim-quote chat routing (B5, plan §8.4.3). Gated
  1659	            # here (not in the planner, which has no auth/doc context):
  1660	            # AUTHED, non-demo, single-document sessions only. Anonymous,
  1661	            # demo, and collection sessions fall through to the normal RAG
  1662	            # path below UNCHANGED — the strict intent still matched, but
  1663	            # without a real document + billing user the verified pipeline
  1664	            # can't run, so this degrades to an ordinary cited answer rather
  1665	            # than erroring. SAME predicate (`strict_quote_routed`, computed
  1666	            # above) already decided the predebit amount — never re-derive
  1667	            # this condition separately (FIX-3: that's exactly how a
  1668	            # quick-mode predebit could drift from what actually runs).
  1669	            if strict_quote_routed:
  1670	                setup_error_code = "QUOTE_SEARCH_ERROR"
  1671	                quote_progress = _VerifiedQuoteProgress()
  1672	                try:
  1673	                    outcome = await self._run_verified_quote_search(
  1674	                        session_id=session_id,
  1675	                        db=db,
  1676	                        document=doc,
  1677	                        user=user,
  1678	                        topic=user_message,
  1679	                        locale=locale,
  1680	                        pre_debited=pre_debited,
  1681	                        predebit_ledger_id=predebit_ledger_id,
  1682	                        progress=quote_progress,
  1683	                    )
  1684	                except asyncio.CancelledError:
  1685	                    # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): `settled` is
  1686	                    # marked BEFORE the resolver even runs — regardless of
  1687	                    # whether it succeeds — so the outer generic handler
  1688	                    # (which now also checks `not settled`, see below) can
  1689	                    # NEVER also attempt its own blind settlement. That was
  1690	                    # the exact "special resolver errors out, outer handler
  1691	                    # falls back to blind settlement" gap Codex r3 found.
  1692	                    # The resolver itself is the durable, race-free
  1693	                    # reconciled_at + conditional-delete design (FIX3-A(b)/
  1694	                    # (c)) — correct regardless of whether the atomic commit
  1695	                    # already landed, is still landing, or never will.
  1696	                    if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  1697	                        settled = True
  1698	                        try:
  1699	                            with anyio.CancelScope(shield=True):
  1700	                                refunded = await asyncio.wait_for(
  1701	                                    _settle_verified_quote_predebit_after_failure(
  1702	                                        user_id=user.id,
  1703	                                        pre_debited=pre_debited,
  1704	                                        predebit_ledger_id=predebit_ledger_id,
  1705	                                        use_independent_session=True,
  1706	                                    ),
  1707	                                    timeout=_CANCEL_IO_TIMEOUT_S,
  1708	                                )
  1709	                            if not refunded:
  1710	                                logger.info(
  1711	                                    "quote_billing.settled_no_refund user=%s ledger=%s: cancellation "
  1712	                                    "after the atomic commit had already reconciled — predebit stands.",
  1713	                                    user.id, predebit_ledger_id,
  1714	                                )
  1715	                        except Exception:
  1716	                            # FIX3-A(d): resolver failure must NEVER fall
  1717	                            # through to ANY further settlement attempt —
  1718	                            # leave the predebit standing and surface it to
  1719	                            # ops for manual review.
  1720	                            logger.error(
  1721	                                "quote_billing.unresolved user=%s ledger=%s pre_debited=%s "
  1722	                                "session=%s: settlement resolver failed during cancellation — "
  1723	                                "predebit left standing, requires manual review.",
  1724	                                user.id, predebit_ledger_id, pre_debited, session_id, exc_info=True,
  1725	                            )
  1726	                    raise
  1727	                except Exception as exc:
  1728	                    # FIX3-A(d) (Codex r3 #4, NOT ADDRESSED): ALL final-
  1729	                    # commit exceptions — not just CancelledError — now
  1730	                    # route through the SAME resolver as the branch above,
  1731	                    # closing the "ordinary 'server committed but COMMIT
  1732	                    # response was lost' exception leaves progress.message_id
  1733	                    # unset and reaches the generic (blind) refund path"
  1734	                    # gap Codex r3 found. `settled` is marked BEFORE the
  1735	                    # resolver runs, same reasoning as the CancelledError
  1736	                    # branch.
  1737	                    if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  1738	                        settled = True
  1739	                        try:
  1740	                            refunded = await _settle_verified_quote_predebit_after_failure(
  1741	                                user_id=user.id,
  1742	                                pre_debited=pre_debited,
  1743	                                predebit_ledger_id=predebit_ledger_id,
  1744	                                use_independent_session=False,
  1745	                                db=db,
  1746	                            )
  1747	                        except Exception:
  1748	                            logger.error(
  1749	                                "quote_billing.unresolved user=%s ledger=%s pre_debited=%s "
  1750	                                "session=%s: settlement resolver failed after an ordinary billing "
  1751	                                "exception — predebit left standing, requires manual review.",
  1752	                                user.id, predebit_ledger_id, pre_debited, session_id, exc_info=True,
  1753	                            )
  1754	                            yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
  1755	                            return
  1756	                        if not refunded:
  1757	                            # The atomic commit had already reconciled — a
  1758	                            # real, delivered, persisted answer — this
  1759	                            # exception struck AFTER that. Predebit stands
  1760	                            # as the charge; never a full refund for a
  1761	                            # delivered answer.
  1762	                            logger.exception(
  1763	                                "Quote-search billing failed after the atomic commit had already "
  1764	                                "reconciled (ledger %s) for user %s — predebit stands, no refund.",
  1765	                                predebit_ledger_id, user.id,
  1766	                            )
  1767	                            yield _safe_sse(
  1768	                                "error", "QUOTE_SEARCH_BILLING_INCOMPLETE", exc, session_id=str(session_id),
  1769	                            )
  1770	                            return
  1771	                        # Refunded — nothing was delivered.
  1772	                        yield _safe_sse("error", "QUOTE_SEARCH_ERROR", exc, session_id=str(session_id))
  1773	                        return
  1774	                    raise
  1775	                # Reconcile already committed inside _run_verified_quote_search —
  1776	                # mark settled BEFORE yielding so a cancellation during these
  1777	                # yields can't ALSO trigger the setup handler's full refund
  1778	                # (double-refund guard, same pattern as the main RAG path).
  1779	                settled = True
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
  1821	            retrieval_plan: QueryPlan | None = None
  1822	            summary_usage = MapReduceUsageCollector()
  1823	            if (
  1824	                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
  1825	                and document_id
  1826	                and not is_collection_session
  1827	            ):
  1828	                yield sse("tool_status", {"message": "Summarizing the document section by section…"})
  1829	                retrieved = await document_brief_service.get_summary_context(
  1830	                    db,
  1831	                    document_id,
  1832	                    max_chunks=18,
  1833	                    usage_collector=summary_usage,
  1834	                )
  1835	                retrieval_strategy = "document_summary_context"
  1836	            elif (
  1837	                query_route.primary_intent == QueryIntent.DOCUMENT_SUMMARY
  1838	                and is_collection_session
  1839	                and collection_doc_ids
  1840	            ):
  1841	                retrieved = await document_brief_service.get_collection_summary_context(
  1842	                    db,
  1843	                    collection_doc_ids,
  1844	                    max_chunks=24,
  1845	                    max_docs=8,
  1846	                )
  1847	                retrieval_strategy = "collection_summary_context"
  1848	            elif is_collection_session and collection_doc_ids:
  1849	                corrective = await corrective_retrieval_service.retrieve_multi(
  1850	                    user_message,
  1851	                    query_route,
  1852	                    collection_doc_ids,
  1853	                    top_k=8,
  1854	                    db=db,
  1855	                )
  1856	                retrieved = corrective.retrieved
  1857	                retrieval_strategy = corrective.strategy
  1858	                retrieval_evaluation = corrective.evaluation
  1859	                retrieval_plan = corrective.plan
  1860	            elif (
  1861	                document_id
  1862	                and query_route.primary_intent == QueryIntent.PAGE_LOOKUP
  1863	                and query_route.page_ref is not None
  1864	            ):
  1865	                retrieved = await _fetch_page_chunks(db, document_id, query_route.page_ref)
  1866	                retrieval_strategy = "page_lookup"
  1867	                if not retrieved:
  1868	                    # Only a PURE page lookup ("what is on page N") skips fallback: answering
  1869	                    # from semantically-similar chunks on OTHER pages gives a wrong-page answer,
  1870	                    # so the Source Locations contract makes the model say page N wasn't found.
  1871	                    # A MIXED page+topic/table query (intents has more than PAGE_LOOKUP, e.g.
  1872	                    # "table on page 8", "requirements on page 12") still needs its evidence —
  1873	                    # fall back to semantic retrieval. (Consensus R2a #1 + Codex r2a review.)
  1874	                    is_pure_page_lookup = query_route.intents == (QueryIntent.PAGE_LOOKUP,)
  1875	                    if is_pure_page_lookup:
  1876	                        retrieved = []
  1877	                        retrieval_strategy = "page_lookup_miss"
  1878	                    else:
  1879	                        corrective = await corrective_retrieval_service.retrieve_single(
  1880	                            user_message, query_route, document_id, top_k=8, db=db,
  1881	                            doc_pages=getattr(doc, "page_count", None),
  1882	                        )
  1883	                        retrieved = corrective.retrieved
  1884	                        retrieval_strategy = corrective.strategy
  1885	                        retrieval_evaluation = corrective.evaluation
  1886	                        retrieval_plan = corrective.plan
  1887	            elif document_id:
  1888	                corrective = await corrective_retrieval_service.retrieve_single(
  1889	                    user_message,
  1890	                    query_route,
  1891	                    document_id,
  1892	                    top_k=8,
  1893	                    db=db,
  1894	                    doc_pages=getattr(doc, "page_count", None),
  1895	                )
  1896	                retrieved = corrective.retrieved
  1897	                retrieval_strategy = corrective.strategy
  1898	                retrieval_evaluation = corrective.evaluation
  1899	                retrieval_plan = corrective.plan
  1900	            else:
  1901	                retrieved = []
  1902	
  1903	            # 5) Build prompt (system)
  1904	            setup_error_code = "CHAT_SETUP_ERROR"
  1905	            numbered_chunks: List[str] = []
  1906	            chunk_map: dict[int, _ChunkInfo] = {}
  1907	            has_map_reduce_summary_context = any(
  1908	                item.get("retrieval_modality") == "summary"
  1909	                or item.get("map_reduce_strategy") == "map_reduce"
  1910	                for item in retrieved
  1911	            )
  1912	            for idx, item in enumerate(retrieved, start=1):
  1913	                # Heuristic truncation to ~350 tokens (roughly 1200-1400 chars)
  1914	                text = item["text"] or ""
  1915	                truncated = text[:1400]
  1916	                chunk_doc_id = item.get("document_id")
  1917	                doc_label = ""
  1918	                if is_collection_session and chunk_doc_id:
  1919	                    fname = collection_doc_names.get(chunk_doc_id, "")
  1920	                    if fname:
  1921	                        doc_label = f"(from: {fname}) "
  1922	                # File-type-aware source location (page/slide/sheet/part), gated for reliability.
  1923	                if is_collection_session and chunk_doc_id:
  1924	                    chunk_ft = collection_doc_types.get(chunk_doc_id)
  1925	                    chunk_pages = collection_doc_pages.get(chunk_doc_id)
  1926	                else:
  1927	                    chunk_ft = getattr(doc, "file_type", None)
  1928	                    chunk_pages = getattr(doc, "page_count", None)
  1929	                src = _source_locator(item, chunk_ft, chunk_pages)
  1930	                src_label = f"({src}) " if src else ""
  1931	                plan_label = _safe_plan_label(item.get("retrieval_plan_step"))
  1932	                evidence_label = f"(evidence: {plan_label}) " if plan_label else ""
  1933	                numbered_chunks.append(f"[{idx}] {doc_label}{src_label}{evidence_label}{truncated}")
  1934	                chunk_map[idx] = _ChunkInfo(
  1935	                    id=item["chunk_id"],
  1936	                    page_start=int(item["page"]),
  1937	                    page_end=int(item.get("page_end", item["page"])),
  1938	                    bboxes=item.get("bboxes") or [],
  1939	                    text=text,
  1940	                    section_title=item.get("section_title") or "",
  1941	                    document_id=chunk_doc_id if chunk_doc_id else document_id,
  1942	                    document_filename=collection_doc_names.get(chunk_doc_id, "")
  1943	                    if chunk_doc_id
  1944	                    else "",
  1945	                    score=item.get("score", 0.0),
  1946	                    table_id=str(item.get("table_id")) if item.get("table_id") else None,
  1947	                    retrieval_modality=str(item.get("retrieval_modality") or "text"),
  1948	                    summary_target_sections=tuple(item.get("map_reduce_target_sections") or ()),
  1949	                    summary_model_covered_sections=tuple(
  1950	                        item.get("map_reduce_model_covered_sections") or ()
  1951	                    ),
  1952	                    summary_fallback_sections=tuple(item.get("map_reduce_fallback_sections") or ()),
  1953	                    summary_missing_sections=tuple(item.get("map_reduce_missing_sections") or ()),
  1954	                )
  1955	
  1956	            rules = get_rules_for_model(
  1957	                effective_model, is_collection=is_collection_session
  1958	            )
  1959	
  1960	            if is_collection_session and retrieval_strategy == "collection_summary_context":
  1961	                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
  1962	                system_prompt = (
  1963	                    "You are a document analysis assistant. The user is asking for a broad summary across a document collection.\n\n"
  1964	                    + SYSTEM_PROMPT_META_RULE
  1965	                    + f"## Available Documents\n{doc_list}\n\n"
  1966	                    + "## Collection Coverage Sources\n"
  1967	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  1968	                    + "\n\n## Summary Rules\n"
  1969	                    + "1. Treat these sources as representative coverage selected across the collection, not as semantic search results for a narrow question.\n"
  1970	                    + "2. Do NOT say the collection is just unrelated sections merely because the context is selective.\n"
  1971	                    + "3. Summarize shared themes, document-specific points, and important caveats when supported.\n"
  1972	                    + "4. If coverage is incomplete, say the answer is based on the cited representative sections instead of refusing.\n"
  1973	                    + "5. Cite every factual paragraph or bullet using the source numbers listed above.\n"
  1974	                    + "6. Your response language MUST match the language of the user's question.\n"
  1975	                    + _citation_contract()
  1976	                )
  1977	            elif is_collection_session:
  1978	                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
  1979	                system_prompt = (
  1980	                    "You are a document analysis assistant. Answer the user's question based on sources from multiple documents.\n\n"
  1981	                    + SYSTEM_PROMPT_META_RULE
  1982	                    + f"## Available Documents\n{doc_list}\n\n"
  1983	                    + "## Document Sources\n"
  1984	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  1985	                    + _retrieval_quality_contract(retrieval_evaluation, retrieval_strategy)
  1986	                    + _query_plan_contract(retrieval_plan)
  1987	                    + "\n\n## Rules\n" + rules
  1988	                    + _citation_contract()
  1989	                )
  1990	            elif retrieval_strategy == "document_summary_context":
  1991	                map_reduce_rule = (
  1992	                    "7. The sources may be map-reduce section summaries generated from source chunks; "
  1993	                    "use the coverage status to distinguish model-covered, fallback, and missing sections.\n"
  1994	                    if has_map_reduce_summary_context
  1995	                    else ""
  1996	                )
  1997	                system_prompt = (
  1998	                    "You are a document analysis assistant. The user is asking for a broad, whole-document summary.\n\n"
  1999	                    + SYSTEM_PROMPT_META_RULE
  2000	                    + "## Document Coverage Sources\n"
  2530	                    )
  2531	
  2532	    async def continue_stream(
  2533	        self,
  2534	        session_id: uuid.UUID,
  2535	        message_id: Optional[uuid.UUID],
  2536	        db: AsyncSession,
  2537	        user: Optional[User] = None,
  2538	        locale: Optional[str] = None,
  2539	        mode: Optional[str] = None,
  2540	    ) -> AsyncGenerator[Dict[str, Any], None]:
  2541	        """Continue a truncated assistant response, appending to the existing message."""
  2542	
  2543	        # 1) Load session
  2544	        row = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
  2545	        session_obj: Optional[ChatSession] = row.scalar_one_or_none()
  2546	        if not session_obj:
  2547	            yield sse("error", {"code": "SESSION_NOT_FOUND", "message": "Session not found"})
  2548	            return
  2549	
  2550	        document_id = session_obj.document_id
  2551	        collection_id = getattr(session_obj, "collection_id", None)
  2552	        is_collection_session = collection_id is not None and document_id is None
  2553	
  2554	        doc = await db.get(Document, document_id) if document_id else None
  2555	
  2556	        # For collection sessions, load document names
  2557	        collection_doc_names: dict[uuid.UUID, str] = {}
  2558	        collection_doc_types: dict[uuid.UUID, str] = {}
  2559	        collection_doc_pages: dict[uuid.UUID, int] = {}
  2560	        if is_collection_session:
  2561	            from app.models.tables import collection_documents as cd_table
  2562	            cd_rows = await db.execute(
  2563	                select(cd_table.c.document_id).where(cd_table.c.collection_id == collection_id)
  2564	            )
  2565	            collection_doc_ids = [r[0] for r in cd_rows.all()]
  2566	            if collection_doc_ids:
  2567	                doc_rows = await db.execute(
  2568	                    select(Document.id, Document.filename, Document.file_type, Document.page_count)
  2569	                    .where(Document.id.in_(collection_doc_ids))
  2570	                )
  2571	                for drow in doc_rows.all():
  2572	                    collection_doc_names[drow[0]] = drow[1]
  2573	                    collection_doc_types[drow[0]] = drow[2]
  2574	                    if drow[3]:
  2575	                        collection_doc_pages[drow[0]] = drow[3]
  2576	
  2577	        # 2) Load assistant message to continue
  2578	        if message_id:
  2579	            asst_msg = await db.get(Message, message_id)
  2580	        else:
  2581	            # Fall back to most recent assistant message in session
  2582	            result = await db.execute(
  2583	                select(Message)
  2584	                .where(Message.session_id == session_id, Message.role == "assistant")
  2585	                .order_by(Message.created_at.desc())
  2586	                .limit(1)
  2587	            )
  2588	            asst_msg = result.scalar_one_or_none()
  2589	
  2590	        if not asst_msg or asst_msg.role != "assistant":
  2591	            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Assistant message not found"})
  2592	            return
  2593	
  2594	        if asst_msg.session_id != session_id:
  2595	            yield sse("error", {"code": "MESSAGE_NOT_FOUND", "message": "Message does not belong to this session"})
  2596	            return
  2597	
  2598	        # 3) Check continuation limit
  2599	        if asst_msg.continuation_count >= settings.MAX_CONTINUATIONS_PER_MESSAGE:
  2600	            yield sse("error", {"code": "CONTINUATION_LIMIT", "message": "Maximum continuations reached"})
  2601	            return
  2602	
  2603	        # 4) Resolve mode → model
  2604	        effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
  2605	        effective_model = settings.MODE_MODELS[effective_mode]
  2606	
  2607	        if user is None and doc and doc.demo_slug:
  2608	            effective_model = settings.DEMO_LLM_MODEL
  2609	            effective_mode = "quick"
  2610	
  2611	        if effective_mode in settings.PREMIUM_MODES:
  2612	            user_plan = (user.plan or "free").lower() if user else "free"
  2613	            if user_plan == "free":
  2614	                yield sse(
  2615	                    "error",
  2616	                    {
  2617	                        "code": "MODE_NOT_ALLOWED",
  2618	                        "message": "Upgrade to Plus to use this mode",
  2619	                        "required_plan": "plus",
  2620	                    },
  2621	                )
  2622	                return
  2623	
  2624	        # 5) Pre-debit credits
  2625	        pre_debited = 0
  2626	        predebit_ledger_id = None
  2627	        if user is not None:
  2628	            estimated = credit_service.get_estimated_cost(effective_mode)
  2629	            predebit_ledger_id = await credit_service.debit_credits(
  2630	                db, user_id=user.id, cost=estimated,
  2631	                reason="chat", ref_type="mode", ref_id=effective_mode,
  2632	            )
  2633	            if predebit_ledger_id:
  2634	                pre_debited = estimated
  2635	                await db.commit()
  2636	            else:
  2637	                balance = await credit_service.get_user_credits(db, user.id)
  2638	                yield sse("error", {
  2639	                    "code": "INSUFFICIENT_CREDITS",
  2640	                    "message": "Insufficient credits",
  2641	                    "required": estimated,
  2642	                    "balance": balance,
  2643	                })
  2644	                return
  2645	
  2646	        settled = False
  2647	        try:
  2648	            # 6) Reconstruct chunk_map from original citations
  2649	            chunk_map: dict[int, _ChunkInfo] = {}
  2650	            original_citations = asst_msg.citations or []
  2651	            if original_citations:
  2652	                chunk_ids_set: set[str] = set()
  2653	                ref_to_chunk_id: dict[int, str] = {}
  2654	                ref_to_citation: dict[int, dict] = {}
  2655	                table_ids_set: set[str] = set()
  2656	                for cit in original_citations:
  2657	                    if not isinstance(cit, dict):
  2658	                        continue
  2659	                    cid = cit.get("chunk_id")
  2660	                    ref = cit.get("ref_index")
  2661	                    if cid and ref is not None:
  2662	                        try:
  2663	                            normalized_ref = int(ref)
  2664	                            normalized_cid = str(uuid.UUID(str(cid)))
  2665	                        except Exception:
  2666	                            continue
  2667	                        chunk_ids_set.add(normalized_cid)
  2668	                        ref_to_chunk_id[normalized_ref] = normalized_cid
  2669	                        ref_to_citation[normalized_ref] = cit
  2670	                        table_id = cit.get("table_id")
  2671	                        if table_id:
  2672	                            try:
  2673	                                table_ids_set.add(str(uuid.UUID(str(table_id))))
  2674	                            except Exception:
  2675	                                pass
  2676	
  2677	                if chunk_ids_set:
  2678	                    chunk_uuids = [uuid.UUID(c) for c in chunk_ids_set]
  2679	                    chunk_rows = await db.execute(
  2680	                        select(Chunk).where(Chunk.id.in_(chunk_uuids))
  2681	                    )
  2682	                    chunks_by_id: dict[str, Chunk] = {}
  2683	                    for ch in chunk_rows.scalars():
  2684	                        chunks_by_id[str(ch.id)] = ch
  2685	
  2686	                    tables_by_id: dict[str, DocumentTable] = {}
  2687	                    if table_ids_set:
  2688	                        table_uuids = [uuid.UUID(tid) for tid in table_ids_set]
  2689	                        table_rows = await db.execute(
  2690	                            select(DocumentTable).where(DocumentTable.id.in_(table_uuids))
  2691	                        )
  2692	                        for table in table_rows.scalars():
  2693	                            tables_by_id[str(table.id)] = table
  2694	
  2695	                    for ref_num, cid in ref_to_chunk_id.items():
  2696	                        ch = chunks_by_id.get(cid)
  2697	                        if ch:
  2698	                            citation = dict(ref_to_citation.get(ref_num) or {})
  2699	                            table_id = citation.get("table_id")
  2700	                            if table_id and not citation.get("table_context"):
  2701	                                table = tables_by_id.get(str(table_id))
  2702	                                if table:
  2703	                                    citation["table_context"] = table_evidence_text(table)
  2704	                                    citation["page"] = table.page
  2705	                                    citation["page_end"] = table.page
  2706	                            chunk_map[ref_num] = _chunk_info_from_persisted_citation(
  2707	                                ch,
  2708	                                citation,
  2709	                                collection_doc_names,
  2710	                            )
  2710	                            )
  2711	
  2712	            # 7) Load conversation history
  2713	            max_turns = int(settings.MAX_CHAT_HISTORY_TURNS or 6)
  2714	            max_msgs = max_turns * 2
  2715	            msgs_row = await db.execute(
  2716	                select(Message)
  2717	                .where(Message.session_id == session_id)
  2718	                .order_by(Message.created_at.desc())
  2719	                .limit(max_msgs + 1)
  2720	            )
  2721	            history_msgs: List[Message] = list(msgs_row.scalars().all())
  2722	            history_msgs.reverse()
  2723	
  2724	            claude_messages: List[dict] = []
  2725	            for m in history_msgs:
  2726	                claude_messages.append({"role": m.role, "content": m.content})
  2727	
  2728	            # Add continuation prompt
  2729	            claude_messages.append({
  2730	                "role": "user",
  2731	                "content": _continuation_prompt(locale, asst_msg.content),
  2732	            })
  2733	
  2734	            # 8) Build system prompt with chunk_map context
  2735	            numbered_chunks: List[str] = []
  2736	            for idx in sorted(chunk_map.keys()):
  2737	                info = chunk_map[idx]
  2738	                text = (info.text or "")[:1400]
  2739	                doc_label = ""
  2740	                if is_collection_session and info.document_id:
  2741	                    fname = collection_doc_names.get(info.document_id, "")
  2742	                    if fname:
  2743	                        doc_label = f"(from: {fname}) "
  2744	                    chunk_ft = collection_doc_types.get(info.document_id)
  2745	                    chunk_pages = collection_doc_pages.get(info.document_id)
  2746	                else:
  2747	                    chunk_ft = getattr(doc, "file_type", None)
  2748	                    chunk_pages = getattr(doc, "page_count", None)
  2749	                src = _source_locator(
  2750	                    {
  2751	                        "page": info.page_start,
  2752	                        "page_end": info.page_end,
  2753	                        "section_title": info.section_title,
  2754	                        "retrieval_modality": info.retrieval_modality,
  2755	                    },
  2756	                    chunk_ft,
  2757	                    chunk_pages,
  2758	                )
  2759	                src_label = f"({src}) " if src else ""
  2760	                numbered_chunks.append(f"[{idx}] {doc_label}{src_label}{text}")
  2761	
  2762	            rules = get_rules_for_model(
  2763	                effective_model, is_collection=is_collection_session
  2764	            )
  2765	
  2766	            if is_collection_session:
  2767	                doc_list = ", ".join(collection_doc_names.values()) if collection_doc_names else "(no documents)"
  2768	                system_prompt = (
  2769	                    "You are a document analysis assistant. Answer the user's question based on sources from multiple documents.\n\n"
  2770	                    + SYSTEM_PROMPT_META_RULE
  2771	                    + f"## Available Documents\n{doc_list}\n\n"
  2772	                    + "## Document Sources\n"
  2773	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2774	                    + "\n\n## Rules\n" + rules
  2775	                    + _citation_contract()
  2776	                )
  2777	            else:
  2778	                system_prompt = (
  2779	                    "You are a document analysis assistant. Answer the user's question based on the following document sources.\n\n"
  2780	                    + SYSTEM_PROMPT_META_RULE
  2781	                    + "## Document Sources\n"
  2782	                    + ("\n".join(numbered_chunks) if numbered_chunks else "(none)")
  2783	                    + "\n\n## Rules\n" + rules
  2784	                    + _citation_contract()
  2785	                )
  2786	
  2787	            if doc and doc.custom_instructions:
  2788	                system_prompt += (
  2789	                    "\n## Custom Instructions\n"
  2790	                    "Follow these custom instructions only when they do not conflict with the role, "
  2791	                    "data-boundary, source-location, citation, language, or safety rules above:\n"
  2792	                    + doc.custom_instructions + "\n"
  2793	                )
  2794	
  2795	            # Global contracts (source-location grounding + terminology guard) — R2a.
  2796	            system_prompt += _source_location_contract() + _output_terminology_contract()
  2797	
  2798	            system_prompt += "\n" + _continuation_system_rule(locale, asst_msg.content)
  2799	        except asyncio.CancelledError:
  2800	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None and not settled:
  2801	                try:
  2802	                    with anyio.CancelScope(shield=True):
  2803	                        await asyncio.wait_for(
  2804	                            _settle_predebit_on_cancel(
  2805	                                user_id=user.id,
  2806	                                pre_debited=pre_debited,
  2807	                                predebit_ledger_id=predebit_ledger_id,
  2808	                                has_answer=False,
  2809	                                prompt_tokens=None,
  2810	                                output_tokens=None,
  2811	                                model=effective_model,
  2812	                                mode=effective_mode,
  2813	                            ),
  2814	                            timeout=_CANCEL_IO_TIMEOUT_S,
  2815	                        )
  2816	                    settled = True
  2817	                except Exception:
  2818	                    logger.exception(
  2819	                        "Failed to settle continuation pre-debit during setup cancellation for user %s",
  2820	                        user.id,
  2821	                    )
  2822	            raise
  2823	        except Exception as e:
  2824	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
  2825	                try:
  2826	                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2827	                    settled = True
  2828	                except Exception:
  2829	                    logger.exception(
  2830	                        "Failed to refund pre-debited credits during continuation setup failure for user %s",
  2831	                        user.id,
  2832	                    )
  2833	            yield _safe_sse("error", "CHAT_SETUP_ERROR", e, session_id=str(session_id))
  2834	            return
  2835	
  2836	        # 9) Stream from LLM
  2837	        try:
  2838	            client = _get_llm_client(effective_model)
  2839	        except Exception as e:
  2840	            if user is not None and pre_debited > 0 and predebit_ledger_id is not None:
  2841	                try:
  2842	                    await _refund_predebit(db, user.id, pre_debited, predebit_ledger_id)
  2843	                    settled = True
  2844	                except Exception:
  2845	                    logger.exception(
  2846	                        "Failed to refund pre-debited credits before continuation LLM client setup for user %s",
  2847	                        user.id,
  2848	                    )
  2849	            yield _safe_sse("error", "LLM_ERROR", e, session_id=str(session_id))
  2850	            return
  2851	        profile = get_model_profile(effective_model)
  2852	
  2853	        if profile.supports_cache_control:
  2854	            sys_msg: dict = {
  2855	                "role": "system",
  2856	                "content": [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
  2857	            }
  2858	        else:
  2859	            sys_msg = {"role": "system", "content": system_prompt}
  2860	        openai_messages = [sys_msg] + claude_messages
  2861	
  2862	        continuation_text_parts: List[str] = []
  2863	        new_citations: List[dict] = []
  2864	        fsm = RefParserFSM(chunk_map)
  2865	        fsm.char_offset = len(asst_msg.content)  # Offset citations relative to full text
  2866	
  2867	        last_ping = time.monotonic()
  2868	        llm_start = time.time()  # for the focus-refinement proxy-budget guard
  2869	        prompt_tokens: Optional[int] = None
  2870	        output_tokens: Optional[int] = None
     1	"""Celery tasks for structured document workbench jobs."""
     2	from __future__ import annotations
     3	
     4	from celery.utils.log import get_task_logger
     5	
     6	from app.services.extraction_service import run_extraction_job_sync
     7	from app.workers.celery_app import celery_app
     8	
     9	logger = get_task_logger(__name__)
    10	
    11	
    12	@celery_app.task(
    13	    name="app.workers.extraction_worker.run_extraction_job",
    14	    bind=True,
    15	    time_limit=420,
    16	    soft_time_limit=360,
    17	    autoretry_for=(Exception,),
    18	    retry_kwargs={"max_retries": 1},
    19	    retry_backoff=30,
    20	)
    21	def run_extraction_job(self, job_id: str) -> None:
    22	    logger.info("Starting structured extraction job %s", job_id)
    23	    run_extraction_job_sync(job_id)
    70	def _as_utc(dt):
    71	    if dt is None:
    72	        return None
    73	    if dt.tzinfo is None:
    74	        return dt.replace(tzinfo=timezone.utc)
    75	    return dt.astimezone(timezone.utc)
    76	
    77	
    78	def _is_zh(text: str) -> bool:
    79	    return any("\u3400" <= ch <= "\u9fff" for ch in text or "")
    80	
    81	
    82	def _copy(plan: ActionPlan, *, en: str, zh: str) -> str:
    83	    status = plan.user_visible_status or ""
    84	    return zh if _is_zh(status) else en
    85	
    86	
    87	async def _verify_document(document_id: uuid.UUID, user: User, db: AsyncSession) -> Document | None:
    88	    doc = await db.get(Document, document_id)
    89	    if not doc or not can_access_document(doc, user):
    90	        return None
    91	    return doc
    92	
    93	
    94	async def _enforce_free_extraction_limit(user: User, db: AsyncSession) -> bool:
    95	    if (user.plan or "free").lower() != "free":
    96	        return True
    97	    window_start = _as_utc(user.monthly_credits_granted_at)
    98	    if window_start is None:
    99	        window_start = datetime.now(timezone.utc) - timedelta(days=30)
   100	    used = await db.scalar(
   101	        select(func.count())
   102	        .select_from(DocumentJob)
   103	        .where(DocumentJob.user_id == user.id)
   104	        .where(DocumentJob.job_type == EXTRACTION_JOB_TYPE)
   105	        .where(DocumentJob.status.in_(["queued", "running", "succeeded"]))
   106	        .where(DocumentJob.created_at >= window_start)
   107	    )
   108	    return int(used or 0) < FREE_MONTHLY_EXTRACTION_LIMIT
   109	
   110	
   111	async def _queue_extraction(
   112	    *,
   113	    user: User,
   114	    db: AsyncSession,
   115	    doc: Document,
   116	    plan: ActionPlan,
   117	    locale: str | None,
   118	    domain_mode: str | None,
   119	) -> ToolExecution:
   120	    template_key = plan.template_key or "executive_summary"
   121	    try:
   122	        template = get_template(template_key)
   123	    except ValueError:
   124	        template = get_template("executive_summary")
   125	
   126	    if not await _enforce_free_extraction_limit(user, db):
   127	        return ToolExecution(
   128	            message=_copy(
   129	                plan,
   130	                en="You have used the free structured extraction allowance. Upgrade to continue creating cited deliverables.",
   131	                zh="你已经用完免费结构化提取额度。升级后可以继续生成带引用的交付物。",
   132	            ),
   133	            artifact=ChatArtifact(
   134	                artifact_type="extraction",
   135	                status="failed",
   136	                title=template.title,
   137	                summary="Structured extraction limit reached.",
   138	                required_plan="plus",
   139	            ),
   140	        )
   141	
   142	    job = DocumentJob(
   143	        user_id=user.id,
   144	        document_id=doc.id,
   145	        job_type=EXTRACTION_JOB_TYPE,
   146	        status="queued",
   147	        input_scope={
   148	            "template_key": template.key,
   149	            "locale": locale,
   150	            "domain_mode": domain_mode,
   151	            "source": "chat",
   152	        },
   153	    )
   154	    db.add(job)
   155	    await db.flush()
   156	    ledger_id = await credit_service.debit_credits(
   157	        db,
   158	        user_id=user.id,
   159	        cost=EXTRACTION_PREDEBIT_CREDITS,
   160	        reason="extraction",
   161	        ref_type="document_job",
   162	        ref_id=str(job.id),
   163	    )
   164	    if ledger_id is None:
   165	        await db.rollback()
   166	        balance = await credit_service.get_user_credits(db, user.id)
   167	        return ToolExecution(
   168	            message=_copy(
   169	                plan,
   170	                en=f"This extraction needs {EXTRACTION_PREDEBIT_CREDITS} credits, but your balance is {balance}.",
   171	                zh=f"这次提取需要 {EXTRACTION_PREDEBIT_CREDITS} 额度，但你当前余额是 {balance}。",
   172	            ),
   173	            artifact=ChatArtifact(
   174	                artifact_type="extraction",
   175	                status="failed",
   176	                title=template.title,
   177	                summary="Insufficient credits.",
   178	            ),
   179	        )
   180	
   181	    job.metadata_json = {
   182	        "predebit_ledger_id": str(ledger_id),
   183	        "pre_debited": EXTRACTION_PREDEBIT_CREDITS,
   184	        "source": "chat_tool",
   185	    }
   186	    db.add(
   187	        ProductEvent(
   188	            user_id=user.id,
   189	            event_name="extraction_created",
   190	            source="chat",
frontend/src/components/Chat/DomainModeSelector.tsx:22:  const domainMode = useDocTalkStore((s) => s.domainMode);
frontend/src/components/Chat/DomainModeSelector.tsx:36:        source: 'domain_mode_selector',
frontend/src/components/Chat/DomainModeSelector.tsx:37:        reason: `${modeId}_domain_mode`,
frontend/src/components/Chat/DomainModeSelector.tsx:39:      router.push(billingHref({ plan: 'plus', source: 'domain_mode_selector', reason: `${modeId}_domain_mode` }));
frontend/src/components/Chat/DomainModeSelector.tsx:49:      aria-label={tOr('domainModes.ariaLabel', 'Domain mode')}
frontend/src/components/Chat/DomainModeSelector.tsx:53:        const active = domainMode === m.id;
frontend/src/components/Chat/DomainModeSelector.tsx:66:            title={locked ? tOr('domainModes.upgradeTooltip', 'Upgrade to Plus to unlock') : m.label}
frontend/src/components/Extraction/ExtractionPanel.tsx:201:        domainMode: domainMode === "legal" || domainMode === "academic" ? domainMode : null,
frontend/src/components/Extraction/ExtractionPanel.tsx:221:  }, [documentId, domainMode, locale, refreshJobs, running, selectedTemplate, userPlan]);
frontend/src/components/Extraction/ExtractionPanel.tsx:470:                      ? tOr("extract.domainModeRequiresPlus", "Legal/Academic domain mode requires the Plus plan.")
frontend/src/components/Extraction/ExtractionPanel.tsx:94:  const domainMode = useDocTalkStore((s) => s.domainMode);
frontend/src/components/PaywallModal.tsx:36:      title: tOr('paywall.domainMode.title', 'Unlock Legal & Academic mode'),
frontend/src/components/PaywallModal.tsx:37:      body: tOr('paywall.domainMode.body', 'Legal and Academic domain mode is available on the Plus plan, tuning citations and prompts for domain-specific reading.'),
frontend/src/components/PaywallModal.tsx:38:      primaryLabel: tOr('paywall.domainMode.cta', 'Upgrade for domain mode'),
frontend/src/components/PaywallModal.tsx:39:      reason: 'domain_mode',
frontend/src/lib/api.ts:1127:  domainMode?: 'legal' | 'academic' | null;
frontend/src/lib/api.ts:1135:      domain_mode: params.domainMode || null,
frontend/src/lib/errorCopy.ts:281:    cta: requiredPlanCta(d, tOr, 'domain_mode'),
frontend/src/lib/sse.ts:183:  domainMode?: string | null,
frontend/src/lib/sse.ts:196:      domain_mode: domainMode ?? null,
frontend/src/lib/useChatStream.ts:320:    const domainMode = useDocTalkStore.getState().domainMode;
frontend/src/lib/useChatStream.ts:332:      domainMode,
frontend/src/store/index.ts:155:  domainMode: null as string | null,
frontend/src/store/index.ts:292:  setDomainMode: (mode: string | null) => set({ domainMode: mode }),
frontend/src/store/index.ts:35:  domainMode: string | null;

exec
/bin/zsh -lc "nl -ba frontend/src/components/Chat/DomainModeSelector.tsx | sed -n '1,130p'
nl -ba frontend/src/lib/useChatStream.ts | sed -n '260,370p;370,620p'
nl -ba frontend/src/lib/sse.ts | sed -n '130,270p'
rg -n --glob '*.{ts,tsx}' 'setDomainMode|domain_mode|domainMode' frontend/src/components frontend/src/hooks frontend/src/lib frontend/src/app | sort
rg -n --glob '*.{ts,tsx}' 'session.*domain|domain.*session|SessionList|restore.*session|selectSession' frontend/src | sort" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
     1	"use client";
     2	
     3	import React from 'react';
     4	import { GraduationCap, Lock, Scale } from 'lucide-react';
     5	import { useRouter } from 'next/navigation';
     6	import { useDocTalkStore } from '../../store';
     7	import { billingHref } from '../../lib/billingLinks';
     8	import { trackEvent } from '../../lib/analytics';
     9	import { useLocale } from '../../i18n';
    10	
    11	interface Props {
    12	  userPlan?: string;
    13	}
    14	
    15	const MODES = [
    16	  { id: null, label: 'Default', icon: null, color: '' },
    17	  { id: 'legal' as const, label: 'Legal', icon: Scale, color: 'amber' },
    18	  { id: 'academic' as const, label: 'Academic', icon: GraduationCap, color: 'blue' },
    19	];
    20	
    21	export default function DomainModeSelector({ userPlan }: Props) {
    22	  const domainMode = useDocTalkStore((s) => s.domainMode);
    23	  const setDomainMode = useDocTalkStore((s) => s.setDomainMode);
    24	  const isStreaming = useDocTalkStore((s) => s.isStreaming);
    25	  const router = useRouter();
    26	  const { tOr } = useLocale();
    27	  const canUse = userPlan === 'plus' || userPlan === 'pro';
    28	
    29	  const chooseMode = (modeId: 'legal' | 'academic' | null) => {
    30	    if (isStreaming) return;
    31	
    32	    if (modeId !== null && !canUse) {
    33	      trackEvent('upgrade_click', {
    34	        plan: 'plus',
    35	        period: 'monthly',
    36	        source: 'domain_mode_selector',
    37	        reason: `${modeId}_domain_mode`,
    38	      });
    39	      router.push(billingHref({ plan: 'plus', source: 'domain_mode_selector', reason: `${modeId}_domain_mode` }));
    40	      return;
    41	    }
    42	
    43	    setDomainMode(modeId);
    44	  };
    45	
    46	  return (
    47	    <div
    48	      role="radiogroup"
    49	      aria-label={tOr('domainModes.ariaLabel', 'Domain mode')}
    50	      className="flex gap-1 rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] p-1 shadow-sm"
    51	    >
    52	      {MODES.map((m) => {
    53	        const active = domainMode === m.id;
    54	        const locked = !canUse && m.id !== null;
    55	        const disabled = isStreaming;
    56	        const Icon = m.icon;
    57	
    58	        return (
    59	          <button
    60	            type="button"
    61	            key={m.id ?? 'default'}
    62	            role="radio"
    63	            aria-checked={active}
    64	            onClick={() => chooseMode(m.id)}
    65	            disabled={disabled}
    66	            title={locked ? tOr('domainModes.upgradeTooltip', 'Upgrade to Plus to unlock') : m.label}
    67	            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
    68	              active
    69	                ? m.id === 'legal'
    70	                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
    71	                  : m.id === 'academic'
    72	                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
    73	                    : 'border-zinc-400 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
    74	                : locked
    75	                  ? 'border-transparent text-zinc-500 hover:bg-[var(--reader-panel-muted)] hover:text-zinc-700 dark:hover:text-zinc-200'
    76	                  : 'border-transparent text-zinc-500 hover:bg-[var(--reader-panel-muted)]'
    77	            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    78	          >
    79	            {locked ? <Lock aria-hidden="true" size={10} /> : Icon && <Icon aria-hidden="true" size={10} />}
    80	            {m.label}
    81	          </button>
    82	        );
    83	      })}
    84	    </div>
    85	  );
    86	}
   260	      role: 'assistant',
   261	      text: copy.body,
   262	      isError: true,
   263	      createdAt: Date.now(),
   264	    });
   265	  }, [addMessage, flushPendingText, getErrorMeta, isAbortLikeError, onShowPaywall, setStreaming, t, tOr, currentPlan]);
   266	
   267	  const handleTruncated = useCallback(() => {
   268	    flushPendingText();
   269	    markLastMessageTruncated(true);
   270	  }, [flushPendingText, markLastMessageTruncated]);
   271	
   272	  const handleStreamDone = useCallback((d: {
   273	    message_id: string;
   274	    can_continue?: boolean;
   275	    continuation_count?: number;
   276	    quote_finder_hint?: boolean;
   277	    quote_finder_topic?: string | null;
   278	  }) => {
   279	    flushPendingText();
   280	    setStreaming(false);
   281	    abortRef.current = null;
   282	    updateSessionActivity(sessionId);
   283	    triggerCreditsRefresh();
   284	    trackEvent('chat_message_completed', { source: 'chat_stream', mode: selectedMode });
   285	    if (d.message_id) {
   286	      updateLastMessageMeta({
   287	        backendId: d.message_id,
   288	        shareAnchor: messageShareAnchorFromId(d.message_id),
   289	        ...(d.continuation_count !== undefined ? { continuationCount: d.continuation_count } : {}),
   290	        quoteFinderHint: d.quote_finder_hint === true,
   291	        quoteFinderTopic: d.quote_finder_topic ?? null,
   292	      });
   293	    }
   294	  }, [flushPendingText, setStreaming, updateSessionActivity, sessionId, selectedMode, updateLastMessageMeta]);
   295	
   296	  const handleAnswerRepaired = useCallback((payload: { text: string; citations: Message['citations'] }) => {
   297	    flushPendingText();
   298	    updateLastMessageMeta({
   299	      text: payload.text,
   300	      citations: payload.citations || [],
   301	      isTruncated: false,
   302	      toolStatus: undefined,
   303	    });
   304	  }, [flushPendingText, updateLastMessageMeta]);
   305	
   306	  // Text-preserving citation update: sentence-level focus added after the
   307	  // answer (cross-lingual / paraphrase). Only the citations change.
   308	  const handleCitationsRefined = useCallback((citations: Message['citations']) => {
   309	    flushPendingText();
   310	    updateLastMessageMeta({ citations: citations || [] });
   311	  }, [flushPendingText, updateLastMessageMeta]);
   312	
   313	  // `onErrorOverride` lets a caller observe an error before it reaches the
   314	  // shared `handleStreamError` (used by regenerateLastResponse to trigger a
   315	  // demo-counter re-anchor without changing sendMessage's behavior at all).
   316	  const streamAssistantResponse = useCallback(async (prompt: string, onErrorOverride?: (err: unknown) => void) => {
   317	    const controller = new AbortController();
   318	    abortRef.current = controller;
   319	
   320	    const domainMode = useDocTalkStore.getState().domainMode;
   321	    await chatStream(
   322	      sessionId,
   323	      prompt,
   324	      ({ text }) => updateLastMessage(text || ''),
   325	      (citation) => addCitationToLastMessage(citation),
   326	      onErrorOverride ?? handleStreamError,
   327	      handleStreamDone,
   328	      handleTruncated,
   329	      selectedMode,
   330	      locale,
   331	      controller.signal,
   332	      domainMode,
   333	      (artifact) => addArtifactToLastMessage(artifact),
   334	      ({ message }) => setLastMessageToolStatus(message),
   335	      handleAnswerRepaired,
   336	      handleCitationsRefined,
   337	    );
   338	  }, [sessionId, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale]);
   339	
   340	  const sendMessage = useCallback(async (text: string) => {
   341	    if (!text.trim() || isStreaming) return false;
   342	
   343	    if (demoLimitReached) {
   344	      onRequireAuth();
   345	      return false;
   346	    }
   347	
   348	    const userMsg: Message = {
   349	      id: `m_${Date.now()}_u`,
   350	      role: 'user',
   351	      text,
   352	      createdAt: Date.now(),
   353	    };
   354	
   355	    const asstMsg: Message = {
   356	      id: `m_${Date.now()}_a`,
   357	      role: 'assistant',
   358	      text: '',
   359	      citations: [],
   360	      createdAt: Date.now(),
   361	    };
   362	
   363	    addMessage(userMsg);
   364	    addMessage(asstMsg);
   365	    // A new user message on this session is itself an accounting-relevant
   366	    // event (it changes what localUserMsgCount will count) — bump so any
   367	    // in-flight reanchorDemoCounter GET for this same session (e.g. from an
   368	    // earlier failed regenerate/continue) recognizes its snapshot is now
   369	    // stale and drops instead of overwriting this message's delta (Codex
   370	    // r4). No-op for authenticated/non-demo sessions.
   370	    // r4). No-op for authenticated/non-demo sessions.
   371	    if (maxUserMessages != null) useDocTalkStore.getState().bumpDemoAccountingEpoch();
   372	    setStreaming(true);
   373	    trackEvent('chat_message_sent', { source: 'chat_panel', mode: selectedMode });
   374	
   375	    await streamAssistantResponse(text);
   376	    return true;
   377	  }, [isStreaming, demoLimitReached, onRequireAuth, addMessage, setStreaming, streamAssistantResponse, selectedMode, maxUserMessages]);
   378	
   379	  // Regenerate/continue add no new user message locally (they resend/extend
   380	  // an existing turn), but the backend increments demo quota on both — so
   381	  // without this the UI would undercount relative to the server. Bumps
   382	  // demoMessagesUsed directly (not the baseline, which only moves at
   383	  // restore/create) and optimistically, before the stream starts — correct
   384	  // whenever the server actually charges, which is the dominant case,
   385	  // including an abort (streaming can only be aborted once the backend has
   386	  // already started responding, so it plausibly already charged). No
   387	  // rollback here on failure — see reanchorDemoCounter above: instead of
   388	  // guessing whether a given failure means the server charged or not (r3:
   389	  // that guess is unsafe — e.g. the continuation endpoint charges quota
   390	  // BEFORE validating the message is still continuable, so a 404/400 there
   391	  // is still a real charge), a failed regenerate/continue re-syncs to
   392	  // server truth directly. No-op outside demo (maxUserMessages == null), so
   393	  // authenticated/non-demo sessions are untouched.
   394	  const bumpDemoUsageForRegenOrContinue = useCallback(() => {
   395	    if (maxUserMessages == null) return;
   396	    const state = useDocTalkStore.getState();
   397	    state.setDemoMessagesUsed(state.demoMessagesUsed + 1);
   398	    // This bump is itself an accounting-relevant event — see the epoch
   399	    // check in reanchorDemoCounter above.
   400	    state.bumpDemoAccountingEpoch();
   401	  }, [maxUserMessages]);
   402	
   403	  const regenerateLastResponse = useCallback(async () => {
   404	    if (isStreaming) return;
   405	
   406	    const msgs = useDocTalkStore.getState().messages;
   407	    let lastUserIdx = -1;
   408	
   409	    for (let i = msgs.length - 1; i >= 0; i--) {
   410	      if (msgs[i].role === 'user') {
   411	        lastUserIdx = i;
   412	        break;
   413	      }
   414	    }
   415	
   416	    if (lastUserIdx === -1) return;
   417	
   418	    const lastUserText = msgs[lastUserIdx].text;
   419	    const trimmed = msgs.slice(0, lastUserIdx + 1);
   420	
   421	    useDocTalkStore.getState().setMessages(trimmed);
   422	    addMessage({ id: `m_${Date.now()}_a`, role: 'assistant', text: '', citations: [], createdAt: Date.now() });
   423	    bumpDemoUsageForRegenOrContinue();
   424	    setStreaming(true);
   425	
   426	    try {
   427	      // Covers errors reported via the SSE error event/mid-stream failures
   428	      // (which resolve normally, so a try/catch alone wouldn't see them) —
   429	      // re-anchor before delegating to the shared error handler.
   430	      await streamAssistantResponse(lastUserText, (err) => {
   431	        reanchorDemoCounter(sessionId);
   432	        handleStreamError(err);
   433	      });
   434	    } catch (e) {
   435	      // Covers a thrown fetch() rejection (network failure before/instead
   436	      // of any SSE response) — the one case the onError override above
   437	      // can't see, since it never fires. Re-throws unchanged (nothing here
   438	      // catches it today either) — this only adds the re-anchor.
   439	      if (!isAbortLikeError(e)) reanchorDemoCounter(sessionId);
   440	      throw e;
   441	    }
   442	  }, [isStreaming, addMessage, setStreaming, streamAssistantResponse, bumpDemoUsageForRegenOrContinue, reanchorDemoCounter, sessionId, handleStreamError, isAbortLikeError]);
   443	
   444	  const continueGenerating = useCallback(async () => {
   445	    if (isStreaming) return;
   446	
   447	    const msgs = useDocTalkStore.getState().messages;
   448	    const lastMsg = msgs[msgs.length - 1];
   449	    if (!lastMsg || lastMsg.role !== 'assistant' || !lastMsg.isTruncated) return;
   450	
   451	    // Clear truncated flag and start streaming
   452	    markLastMessageTruncated(false);
   453	    bumpDemoUsageForRegenOrContinue();
   454	    setStreaming(true);
   455	
   456	    const controller = new AbortController();
   457	    abortRef.current = controller;
   458	
   459	    try {
   460	      await continueStream(
   461	        sessionId,
   462	        lastMsg.backendId || '',
   463	        ({ text }) => updateLastMessage(text || ''),
   464	        (citation) => addCitationToLastMessage(citation),
   465	        // Re-anchor before delegating — covers SSE error-event/mid-stream
   466	        // failures, which resolve normally (see the try/catch below for the
   467	        // thrown-fetch-rejection case a callback can't see).
   468	        (err) => {
   469	          reanchorDemoCounter(sessionId);
   470	          handleStreamError(err);
   471	        },
   472	        handleStreamDone,
   473	        handleTruncated,
   474	        selectedMode,
   475	        locale,
   476	        controller.signal,
   477	        (artifact) => addArtifactToLastMessage(artifact),
   478	        ({ message }) => setLastMessageToolStatus(message),
   479	        handleAnswerRepaired,
   480	        handleCitationsRefined,
   481	      );
   482	    } catch (e) {
   483	      // Thrown fetch() rejection — re-throws unchanged (nothing here catches
   484	      // it today either), this only adds the re-anchor.
   485	      if (!isAbortLikeError(e)) reanchorDemoCounter(sessionId);
   486	      throw e;
   487	    }
   488	  }, [isStreaming, sessionId, markLastMessageTruncated, setStreaming, updateLastMessage, addCitationToLastMessage, addArtifactToLastMessage, setLastMessageToolStatus, handleStreamError, handleStreamDone, handleTruncated, handleAnswerRepaired, handleCitationsRefined, selectedMode, locale, bumpDemoUsageForRegenOrContinue, reanchorDemoCounter, isAbortLikeError]);
   489	
   490	  const stopStreaming = useCallback(() => {
   491	    abortRef.current?.abort();
   492	    abortRef.current = null;
   493	    flushPendingText();
   494	    setStreaming(false);
   495	  }, [flushPendingText, setStreaming]);
   496	
   497	  return useMemo(() => ({
   498	    sendMessage,
   499	    regenerateLastResponse,
   500	    continueGenerating,
   501	    stopStreaming,
   502	    demoRemaining,
   503	    demoLimitReached,
   504	    messagesUsed,
   505	    maxMessages,
   506	  }), [sendMessage, regenerateLastResponse, continueGenerating, stopStreaming, demoRemaining, demoLimitReached, messagesUsed, maxMessages]);
   507	}
   130	            case 'citations_refined':
   131	              // Text-preserving citation update (sentence-level focus added
   132	              // post-generation for cross-lingual / paraphrase answers).
   133	              onCitationsRefined?.(
   134	                Array.isArray(data.citations) ? data.citations.map(mapCitationPayload) : [],
   135	              );
   136	              break;
   137	            case 'done':
   138	              receivedDone = true;
   139	              onDone({
   140	                message_id: typeof data.message_id === 'string' ? data.message_id : '',
   141	                can_continue: data.can_continue === true,
   142	                continuation_count: typeof data.continuation_count === 'number' ? data.continuation_count : undefined,
   143	                quote_finder_hint: data.quote_finder_hint === true,
   144	                quote_finder_topic: typeof data.quote_finder_topic === 'string' ? data.quote_finder_topic : null,
   145	              });
   146	              break;
   147	            default:
   148	              // ignore pings and unknown events
   149	              break;
   150	          }
   151	        } catch (e) {
   152	          if (signal?.aborted) return;
   153	          receivedTerminalError = true;
   154	          onError({ code: 'parse_error', message: String(e) });
   155	          await reader.cancel().catch(() => {});
   156	          return;
   157	        }
   158	      }
   159	    }
   160	  } catch (e) {
   161	    if (signal?.aborted) return;
   162	    receivedTerminalError = true;
   163	    onError({ code: 'stream_error', message: String(e) });
   164	  }
   165	
   166	  if (!receivedDone && !receivedTerminalError && !signal?.aborted) {
   167	    onTruncated?.();
   168	    onDone({ message_id: '' });
   169	  }
   170	}
   171	
   172	export async function chatStream(
   173	  sessionId: string,
   174	  message: string,
   175	  onToken: (p: TokenPayload) => void,
   176	  onCitation: (c: Citation) => void,
   177	  onError: (e: ErrorPayload) => void,
   178	  onDone: (d: DonePayload) => void,
   179	  onTruncated?: () => void,
   180	  mode?: string,
   181	  locale?: string,
   182	  signal?: AbortSignal,
   183	  domainMode?: string | null,
   184	  onArtifact?: (artifact: ChatArtifact) => void,
   185	  onToolStatus?: (status: ToolStatusPayload) => void,
   186	  onAnswerRepaired?: (payload: AnswerRepairedPayload) => void,
   187	  onCitationsRefined?: (citations: Citation[]) => void,
   188	) {
   189	  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/chat`, {
   190	    method: 'POST',
   191	    headers: { 'Content-Type': 'application/json' },
   192	    body: JSON.stringify({
   193	      message,
   194	      ...(mode ? { mode } : {}),
   195	      ...(locale ? { locale } : {}),
   196	      domain_mode: domainMode ?? null,
   197	    }),
   198	    signal,
   199	  });
   200	
   201	  if (!res.ok || !res.body) {
   202	    if (signal?.aborted) return;
   203	    const raw = await res.text().catch(() => '');
   204	    let code = 'http_error';
   205	    let message = `HTTP ${res.status}: ${raw}`;
   206	    try {
   207	      const parsed = JSON.parse(raw);
   208	      const d = parsed && typeof parsed === 'object' && 'detail' in parsed
   209	        ? (parsed as Record<string, unknown>).detail
   210	        : parsed;
   211	      if (d && typeof d === 'object') {
   212	        const detail = d as Record<string, unknown>;
   213	        if (typeof detail.error === 'string') code = detail.error;
   214	        if (typeof detail.message === 'string') message = detail.message;
   215	      }
   216	    } catch {
   217	      // leave http_error + raw message as fallback
   218	    }
   219	    onError({ code, message, status: res.status });
   220	    return;
   221	  }
   222	
   223	  const reader = res.body.getReader();
   224	  await _processSSEStream(reader, onToken, onCitation, onError, onDone, onTruncated, onArtifact, onToolStatus, onAnswerRepaired, onCitationsRefined, signal);
   225	}
   226	
   227	export async function continueStream(
   228	  sessionId: string,
   229	  messageId: string,
   230	  onToken: (p: TokenPayload) => void,
   231	  onCitation: (c: Citation) => void,
   232	  onError: (e: ErrorPayload) => void,
   233	  onDone: (d: DonePayload) => void,
   234	  onTruncated?: () => void,
   235	  mode?: string,
   236	  locale?: string,
   237	  signal?: AbortSignal,
   238	  onArtifact?: (artifact: ChatArtifact) => void,
   239	  onToolStatus?: (status: ToolStatusPayload) => void,
   240	  onAnswerRepaired?: (payload: AnswerRepairedPayload) => void,
   241	  onCitationsRefined?: (citations: Citation[]) => void,
   242	) {
   243	  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/chat/continue`, {
   244	    method: 'POST',
   245	    headers: { 'Content-Type': 'application/json' },
   246	    body: JSON.stringify({
   247	      message_id: messageId || undefined,
   248	      ...(mode ? { mode } : {}),
   249	      ...(locale ? { locale } : {}),
   250	    }),
   251	    signal,
   252	  });
   253	
   254	  if (!res.ok || !res.body) {
   255	    if (signal?.aborted) return;
   256	    const raw = await res.text().catch(() => '');
   257	    let code = 'http_error';
   258	    let message = `HTTP ${res.status}: ${raw}`;
   259	    try {
   260	      const parsed = JSON.parse(raw);
   261	      const d = parsed && typeof parsed === 'object' && 'detail' in parsed
   262	        ? (parsed as Record<string, unknown>).detail
   263	        : parsed;
   264	      if (d && typeof d === 'object') {
   265	        const detail = d as Record<string, unknown>;
   266	        if (typeof detail.error === 'string') code = detail.error;
   267	        if (typeof detail.message === 'string') message = detail.message;
   268	      }
   269	    } catch {
   270	      // leave http_error + raw message as fallback
rg: frontend/src/hooks: No such file or directory (os error 2)
frontend/src/components/Chat/DomainModeSelector.tsx:22:  const domainMode = useDocTalkStore((s) => s.domainMode);
frontend/src/components/Chat/DomainModeSelector.tsx:23:  const setDomainMode = useDocTalkStore((s) => s.setDomainMode);
frontend/src/components/Chat/DomainModeSelector.tsx:36:        source: 'domain_mode_selector',
frontend/src/components/Chat/DomainModeSelector.tsx:37:        reason: `${modeId}_domain_mode`,
frontend/src/components/Chat/DomainModeSelector.tsx:39:      router.push(billingHref({ plan: 'plus', source: 'domain_mode_selector', reason: `${modeId}_domain_mode` }));
frontend/src/components/Chat/DomainModeSelector.tsx:43:    setDomainMode(modeId);
frontend/src/components/Chat/DomainModeSelector.tsx:49:      aria-label={tOr('domainModes.ariaLabel', 'Domain mode')}
frontend/src/components/Chat/DomainModeSelector.tsx:53:        const active = domainMode === m.id;
frontend/src/components/Chat/DomainModeSelector.tsx:66:            title={locked ? tOr('domainModes.upgradeTooltip', 'Upgrade to Plus to unlock') : m.label}
frontend/src/components/Extraction/ExtractionPanel.tsx:201:        domainMode: domainMode === "legal" || domainMode === "academic" ? domainMode : null,
frontend/src/components/Extraction/ExtractionPanel.tsx:221:  }, [documentId, domainMode, locale, refreshJobs, running, selectedTemplate, userPlan]);
frontend/src/components/Extraction/ExtractionPanel.tsx:470:                      ? tOr("extract.domainModeRequiresPlus", "Legal/Academic domain mode requires the Plus plan.")
frontend/src/components/Extraction/ExtractionPanel.tsx:94:  const domainMode = useDocTalkStore((s) => s.domainMode);
frontend/src/components/PaywallModal.tsx:36:      title: tOr('paywall.domainMode.title', 'Unlock Legal & Academic mode'),
frontend/src/components/PaywallModal.tsx:37:      body: tOr('paywall.domainMode.body', 'Legal and Academic domain mode is available on the Plus plan, tuning citations and prompts for domain-specific reading.'),
frontend/src/components/PaywallModal.tsx:38:      primaryLabel: tOr('paywall.domainMode.cta', 'Upgrade for domain mode'),
frontend/src/components/PaywallModal.tsx:39:      reason: 'domain_mode',
frontend/src/lib/api.ts:1127:  domainMode?: 'legal' | 'academic' | null;
frontend/src/lib/api.ts:1135:      domain_mode: params.domainMode || null,
frontend/src/lib/errorCopy.ts:281:    cta: requiredPlanCta(d, tOr, 'domain_mode'),
frontend/src/lib/sse.ts:183:  domainMode?: string | null,
frontend/src/lib/sse.ts:196:      domain_mode: domainMode ?? null,
frontend/src/lib/useChatStream.ts:320:    const domainMode = useDocTalkStore.getState().domainMode;
frontend/src/lib/useChatStream.ts:332:      domainMode,
frontend/src/app/collections/[collectionId]/page.tsx:11:import SessionList from '../../../components/Collections/SessionList';
frontend/src/app/collections/[collectionId]/page.tsx:370:            <SessionList
frontend/src/app/collections/[collectionId]/page.tsx:404:              <SessionList
frontend/src/components/Collections/SessionList.tsx:15:export default function SessionList({ sessions, activeSessionId, onSelectSession, onNewSession }: SessionListProps) {
frontend/src/components/Collections/SessionList.tsx:8:interface SessionListProps {
frontend/src/lib/api.ts:1:import type { DocumentResponse, Message, SearchResponse, Citation, SessionListResponse, CollectionBrief, CollectionDetail, NormalizedBBox, ExtractionJob, ExtractionTemplate, DocumentTable, QuestionTemplate, DocumentHierarchicalBrief, ChatArtifact } from '../types';
frontend/src/lib/api.ts:468:export async function listSessions(docId: string): Promise<SessionListResponse> {
frontend/src/lib/api.ts:652:export async function listCollectionSessions(collectionId: string): Promise<SessionListResponse> {
frontend/src/types/index.ts:182:export interface SessionListResponse {

exec
/bin/zsh -lc "rg -n --glob '*.{ts,tsx}' 'clearDocumentTransientState|reset\\(|domainMode:' frontend/src/store frontend/src/components frontend/src/app frontend/src/lib
nl -ba frontend/src/store/index.ts | sed -n '1,210p;210,330p'
nl -ba frontend/src/lib/useChatStream.ts | sed -n '1,270p'
nl -ba frontend/src/components/Chat/ChatPanel.tsx | sed -n '1,300p'
nl -ba frontend/src/components/Collections/SessionList.tsx | sed -n '1,150p'
nl -ba frontend/src/types/index.ts | sed -n '160,205p'
rg -n --glob '*.{ts,tsx}' 'useChatSession' frontend/src" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
frontend/src/store/index.ts:35:  domainMode: string | null;
frontend/src/store/index.ts:60:  // effect (never in clearDocumentTransientState below) — that effect fires
frontend/src/store/index.ts:63:  // them from clearDocumentTransientState was tried (6149931) and reverted
frontend/src/store/index.ts:78:  // useChatStream.ts for the read side. Monotonic ACROSS `reset()` too, not
frontend/src/store/index.ts:79:  // just within one document's lifetime (Codex r5) — `reset()` increments
frontend/src/store/index.ts:128:  clearDocumentTransientState: () => void;
frontend/src/store/index.ts:155:  domainMode: null as string | null,
frontend/src/store/index.ts:292:  setDomainMode: (mode: string | null) => set({ domainMode: mode }),
frontend/src/store/index.ts:338:  clearDocumentTransientState: () => set({
frontend/src/store/index.ts:364:      // a Back-Home reset() survive it, then match again after the epoch
frontend/src/lib/useChatSession.ts:31:    // clearDocumentTransientState (Codex r2 #2 finding: that function is
frontend/src/app/global-error.tsx:28:            onClick={() => reset()}
frontend/src/components/Extraction/ExtractionPanel.tsx:201:        domainMode: domainMode === "legal" || domainMode === "academic" ? domainMode : null,
frontend/src/lib/useDocumentLoader.ts:43:    clearDocumentTransientState,
frontend/src/lib/useDocumentLoader.ts:58:    clearDocumentTransientState();
frontend/src/lib/useDocumentLoader.ts:163:  }, [documentId, setDocument, setPdfUrl, setDocumentName, setDocumentStatus, setLastDocument, setDocumentSummary, setSuggestedQuestions, clearDocumentTransientState, t, tOr]);
frontend/src/app/d/[documentId]/error.tsx:28:            onClick={() => reset()}
frontend/src/app/collections/[collectionId]/error.tsx:28:            onClick={() => reset()}
frontend/src/components/SessionDropdown.tsx:173:    reset();
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
    71	  // Monotonic counter bumped by every operation that mutates the two demo
    72	  // fields above (adopt/create, sendMessage start, regen/continue bump,
    73	  // SessionDropdown's session switch/new-chat installs) — NOT by
    74	  // reanchorDemoCounter itself. Lets a fire-and-forget reanchor GET detect
    75	  // whether some other accounting event happened while it was in flight,
    76	  // even when it targets the same session (a plain sessionId check can't
    77	  // tell the difference — Codex r4). See reanchorDemoCounter in
    78	  // useChatStream.ts for the read side. Monotonic ACROSS `reset()` too, not
    79	  // just within one document's lifetime (Codex r5) — `reset()` increments
    80	  // rather than restoring 0, so no pre-reset epoch value can ever recur and
    81	  // collide with a stale pending reanchor from before the reset.
    82	  demoAccountingEpoch: number;
    83	
    84	  // PDF Search
    85	  searchQuery: string;
    86	  searchMatches: Array<{ page: number; index: number }>;
    87	  currentMatchIndex: number;
    88	  _pendingText: string;
    89	  _flushTimer: ReturnType<typeof setTimeout> | null;
    90	
    91	  // Actions
    92	  setDocument: (id: string) => void;
    93	  setDocumentName: (name: string) => void;
    94	  setDocumentStatus: (status: DocStatus) => void;
    95	  setLastDocument: (id: string, name: string) => void;
    96	  setPdfUrl: (url: string | null) => void;
    97	  setPage: (page: number) => void;
    98	  setScale: (scale: number) => void;
    99	  setGrabMode: (v: boolean) => void;
   100	  setHighlights: (highlights: NormalizedBBox[]) => void;
   101	  navigateToCitation: (citation: Citation) => void;
   102	  addMessage: (msg: Message) => void;
   103	  updateLastMessage: (text: string) => void;
   104	  addCitationToLastMessage: (citation: Citation) => void;
   105	  addArtifactToLastMessage: (artifact: ChatArtifact) => void;
   106	  setLastMessageToolStatus: (message: string) => void;
   107	  setStreaming: (v: boolean) => void;
   108	  setSessionId: (id: string | null) => void;
   109	  setSelectedMode: (id: string) => void;
   110	  setDomainMode: (mode: string | null) => void;
   111	  setMessages: (msgs: Message[]) => void;
   112	  setSessions: (sessions: SessionItem[]) => void;
   113	  addSession: (session: SessionItem) => void;
   114	  removeSession: (sessionId: string) => void;
   115	  updateSessionActivity: (sessionId: string) => void;
   116	  setDocumentSummary: (summary: string | null) => void;
   117	  setSuggestedQuestions: (questions: string[]) => void;
   118	  setUserPlan: (plan: PlanType) => void;
   119	  setDemoMessagesUsed: (count: number) => void;
   120	  setDemoRestoredUserMsgCount: (count: number) => void;
   121	  bumpDemoAccountingEpoch: () => void;
   122	  setSearchQuery: (query: string) => void;
   123	  setSearchMatches: (matches: Array<{ page: number; index: number }>) => void;
   124	  setCurrentMatchIndex: (index: number) => void;
   125	  markLastMessageTruncated: (truncated: boolean) => void;
   126	  updateLastMessageMeta: (updates: Partial<Message>) => void;
   127	  flushPendingText: () => void;
   128	  clearDocumentTransientState: () => void;
   129	  reset: () => void;
   130	}
   131	
   132	const initialState = {
   133	  documentId: null as string | null,
   134	  documentName: null as string | null,
   135	  documentStatus: 'idle' as DocStatus,
   136	  totalPages: 0,
   137	  parseProgress: { pagesParsed: 0, chunksIndexed: 0 },
   138	  lastDocumentId: (typeof window !== 'undefined' ? localStorage.getItem('doctalk_last_doc_id') : null) as string | null,
   139	  lastDocumentName: (typeof window !== 'undefined' ? localStorage.getItem('doctalk_last_doc_name') : null) as string | null,
   140	  currentPage: 1,
   141	  scale: 1,
   142	  grabMode: false,
   143	  highlights: [] as NormalizedBBox[],
   144	  pdfUrl: null as string | null,
   145	  sessionId: null as string | null,
   146	  messages: [] as Message[],
   147	  isStreaming: false,
   148	  scrollNonce: 0,
   149	  selectedMode: (() => {
   150	    const stored = typeof window !== 'undefined' ? localStorage.getItem('doctalk_mode') : null;
   151	    // Migration: old model IDs or retired modes (for example "thorough") reset to Flash.
   152	    if (!isKnownMode(stored) || stored.includes('/')) return DEFAULT_MODE;
   153	    return stored;
   154	  })(),
   155	  domainMode: null as string | null,
   156	  sessions: [] as SessionItem[],
   157	  documentSummary: null as string | null,
   158	  suggestedQuestions: [] as string[],
   159	  userPlan: 'free' as PlanType,
   160	  highlightSnippet: null as string | null,
   161	  highlightFocus: null as string | null,
   162	  demoMessagesUsed: 0,
   163	  demoRestoredUserMsgCount: 0,
   164	  demoAccountingEpoch: 0,
   165	  searchQuery: '',
   166	  searchMatches: [] as Array<{ page: number; index: number }>,
   167	  currentMatchIndex: -1,
   168	  _pendingText: '',
   169	  _flushTimer: null as ReturnType<typeof setTimeout> | null,
   170	};
   171	
   172	export const useDocTalkStore = create<DocTalkStore>((set, get) => ({
   173	  ...initialState,
   174	
   175	  setDocument: (id: string) => set({ documentId: id }),
   176	  setDocumentName: (name: string) => set({ documentName: name }),
   177	  setDocumentStatus: (status: DocStatus) => set({ documentStatus: status }),
   178	  setLastDocument: (id: string, name: string) => {
   179	    set({ lastDocumentId: id, lastDocumentName: name });
   180	    try {
   181	      localStorage.setItem('doctalk_last_doc_id', id);
   182	      localStorage.setItem('doctalk_last_doc_name', name);
   183	    } catch {
   184	      // localStorage unavailable in private browsing
   185	    }
   186	  },
   187	  setPdfUrl: (url: string | null) => set({ pdfUrl: url }),
   188	  setPage: (page: number) => set({ currentPage: Math.max(1, page) }),
   189	  setScale: (scale: number) => set({ scale: Math.max(0.25, scale) }),
   190	  setGrabMode: (v: boolean) => set({ grabMode: v }),
   191	  setHighlights: (highlights: NormalizedBBox[]) => set({ highlights }),
   192	  navigateToCitation: (citation: Citation) => {
   193	    const bboxes = (citation.bboxes || []).map((bb: NormalizedBBox) => ({
   194	      ...bb,
   195	      page: bb.page ?? citation.page,
   196	    }));
   197	    set((state) => ({
   198	      currentPage: citation.page,
   199	      highlights: bboxes,
   200	      // Chunk snippet stays the reliable fallback (converted-PDF/TextViewer
   201	      // paths depend on it). The focus sentence is layered ON TOP as emphasis.
   202	      highlightSnippet: citation.textSnippet || null,
   203	      highlightFocus: citation.focusSnippet || null,
   204	      scrollNonce: state.scrollNonce + 1,
   205	    }));
   206	  },
   207	  addMessage: (msg: Message) => set({ messages: [...get().messages, msg] }),
   208	  setMessages: (msgs: Message[]) => set({ messages: msgs }),
   209	  updateLastMessage: (text: string) => {
   210	    if (!text) return;
   210	    if (!text) return;
   211	    const state = get();
   212	    set({ _pendingText: (state._pendingText || '') + text });
   213	
   214	    if (!state._flushTimer) {
   215	      const timer = setTimeout(() => {
   216	        const s = get();
   217	        const msgs = s.messages;
   218	
   219	        if (msgs.length === 0) {
   220	          set({ _pendingText: '', _flushTimer: null });
   221	          return;
   222	        }
   223	
   224	        const last = msgs[msgs.length - 1];
   225	        const updated = { ...last, text: (last.text || '') + s._pendingText };
   226	        set({
   227	          messages: [...msgs.slice(0, -1), updated],
   228	          _pendingText: '',
   229	          _flushTimer: null,
   230	        });
   231	      }, 50);
   232	
   233	      set({ _flushTimer: timer });
   234	    }
   235	  },
   236	  flushPendingText: () => {
   237	    const state = get();
   238	    if (state._flushTimer) clearTimeout(state._flushTimer);
   239	    if (!state._pendingText) {
   240	      set({ _flushTimer: null });
   241	      return;
   242	    }
   243	
   244	    const msgs = state.messages;
   245	    if (msgs.length === 0) {
   246	      set({ _pendingText: '', _flushTimer: null });
   247	      return;
   248	    }
   249	
   250	    const last = msgs[msgs.length - 1];
   251	    const updated = { ...last, text: (last.text || '') + state._pendingText };
   252	    set({
   253	      messages: [...msgs.slice(0, -1), updated],
   254	      _pendingText: '',
   255	      _flushTimer: null,
   256	    });
   257	  },
   258	  addCitationToLastMessage: (citation: Citation) => {
   259	    const msgs = get().messages;
   260	    if (msgs.length === 0) return;
   261	    const last = msgs[msgs.length - 1];
   262	    const citations = [...(last.citations || []), citation];
   263	    const updated = { ...last, citations } as Message;
   264	    set({ messages: [...msgs.slice(0, -1), updated] });
   265	  },
   266	  addArtifactToLastMessage: (artifact: ChatArtifact) => {
   267	    const msgs = get().messages;
   268	    if (msgs.length === 0) return;
   269	    const last = msgs[msgs.length - 1];
   270	    const existing = last.artifacts || [];
   271	    const next = artifact.jobId
   272	      ? existing.filter((item) => item.jobId !== artifact.jobId)
   273	      : existing;
   274	    set({ messages: [...msgs.slice(0, -1), { ...last, artifacts: [...next, artifact] }] });
   275	  },
   276	  setLastMessageToolStatus: (message: string) => {
   277	    const msgs = get().messages;
   278	    if (msgs.length === 0) return;
   279	    const last = msgs[msgs.length - 1];
   280	    set({ messages: [...msgs.slice(0, -1), { ...last, toolStatus: message }] });
   281	  },
   282	  setStreaming: (v: boolean) => set({ isStreaming: v }),
   283	  setSessionId: (id: string | null) => set({ sessionId: id }),
   284	  setSelectedMode: (id: string) => {
   285	    set({ selectedMode: id });
   286	    try {
   287	      localStorage.setItem('doctalk_mode', id);
   288	    } catch {
   289	      // localStorage unavailable in private browsing
   290	    }
   291	  },
   292	  setDomainMode: (mode: string | null) => set({ domainMode: mode }),
   293	  setSessions: (sessions: SessionItem[]) => set({ sessions }),
   294	  addSession: (session: SessionItem) => set((state) => ({
   295	    sessions: [session, ...state.sessions],
   296	  })),
   297	  removeSession: (sessionId: string) => set((state) => ({
   298	    sessions: state.sessions.filter((s) => s.session_id !== sessionId),
   299	  })),
   300	  updateSessionActivity: (sessionId: string) => set((state) => {
   301	    const now = new Date().toISOString();
   302	    const updated = state.sessions.map((s) =>
   303	      s.session_id === sessionId
   304	        ? { ...s, last_activity_at: now, message_count: s.message_count + 1 }
   305	        : s
   306	    );
   307	    // 重排：将活跃 session 移到顶部
   308	    updated.sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());
   309	    return { sessions: updated };
   310	  }),
   311	  setDocumentSummary: (summary: string | null) => set({ documentSummary: summary }),
   312	  setSuggestedQuestions: (questions: string[]) => set({ suggestedQuestions: questions }),
   313	  setUserPlan: (plan: PlanType) => set({ userPlan: plan }),
   314	  setDemoMessagesUsed: (count: number) => set({ demoMessagesUsed: count }),
   315	  setDemoRestoredUserMsgCount: (count: number) => set({ demoRestoredUserMsgCount: count }),
   316	  bumpDemoAccountingEpoch: () => set((state) => ({ demoAccountingEpoch: state.demoAccountingEpoch + 1 })),
   317	  setSearchQuery: (query: string) => set({ searchQuery: query }),
   318	  setSearchMatches: (matches) => set({ searchMatches: matches }),
   319	  setCurrentMatchIndex: (index: number) => set({ currentMatchIndex: index }),
   320	  markLastMessageTruncated: (truncated: boolean) => {
   321	    const msgs = get().messages;
   322	    if (msgs.length === 0) return;
   323	    const last = msgs[msgs.length - 1];
   324	    set({ messages: [...msgs.slice(0, -1), { ...last, isTruncated: truncated }] });
   325	  },
   326	  updateLastMessageMeta: (updates) => {
   327	    const msgs = get().messages;
   328	    if (msgs.length === 0) return;
   329	    const last = msgs[msgs.length - 1];
   330	    set({ messages: [...msgs.slice(0, -1), { ...last, ...updates }] });
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
   135	    // Captured synchronously at call time (not read again after the GET
   136	    // resolves) — see the epoch check below for why.
   137	    const epochAtCall = useDocTalkStore.getState().demoAccountingEpoch;
   138	    getMessages(forSessionId)
   139	      .then((msgsData) => {
   140	        if (msgsData.demo_messages_used == null) return;
   141	        const state = useDocTalkStore.getState();
   142	        // The GET can resolve after the user has already navigated away —
   143	        // e.g. useChatSession's effect ran its synchronous reset for a NEW
   144	        // document/session while this was in flight. Re-read the CURRENT
   145	        // sessionId from the store (not a closure) and only write if it
   146	        // still matches the session this reanchor was called for; otherwise
   147	        // the fetched-for-A truth would clobber whatever B's own
   148	        // adopt/create already established.
   149	        if (state.sessionId !== forSessionId) return;
   150	        // Same-session guard alone isn't enough (Codex r4): a failed
   151	        // regenerate can issue this GET, and the user can send a NEW
   152	        // message on the SAME session before it resolves — the sessionId
   153	        // check can't see that, since sendMessage never changes sessionId.
   154	        // demoAccountingEpoch is bumped by every operation that mutates
   155	        // these two fields (adopt/create, sendMessage start, regen/continue
   156	        // bump); if it moved since this reanchor was issued, some other
   157	        // accounting event happened in between and its own state is
   158	        // authoritative — writing this stale snapshot over it would erase
   159	        // that newer event's delta. Drop it silently either way; a later
   160	        // failure (if any) issues its own fresh reanchor against current
   161	        // state.
   162	        if (state.demoAccountingEpoch !== epochAtCall) return;
   163	        state.setDemoMessagesUsed(msgsData.demo_messages_used);
   164	        state.setDemoRestoredUserMsgCount(
   165	          state.messages.filter((m) => m.role === 'user').length,
   166	        );
   167	      })
   168	      .catch(() => {
   169	        // best-effort — a later restore/regenerate/continue will try again
   170	      });
   171	  }, [maxUserMessages]);
   172	
   173	  const handleStreamError = useCallback((err: unknown) => {
   174	    flushPendingText();
   175	    setStreaming(false);
   176	    abortRef.current = null;
   177	
   178	    const { message, code, status } = getErrorMeta(err);
   179	
   180	    if (isAbortLikeError(err)) {
   181	      return;
   182	    }
   183	
   184	    if (
   185	      status === 402
   186	      || code === 'INSUFFICIENT_CREDITS'
   187	      || code === 'MODE_NOT_ALLOWED'
   188	      || code === 'PRO_MODE_LIMIT_REACHED'
   189	      || code === 'BALANCED_MODE_LIMIT_REACHED'
   190	      || code === 'DOMAIN_MODE_REQUIRES_PLUS'
   191	    ) {
   192	      const reason = code || 'paid_limit';
   193	      // I27: previously hardcoded `plan: 'plus'`, which falsely attributed
   194	      // every paywall event in the funnel to plus-upgrade intent regardless
   195	      // of what triggered it (e.g. a Plus user hitting the Pro cap was logged
   196	      // as a Plus-upgrade event). Derive the actual upgrade target from
   197	      // (currentPlan, reason) so the upgrade-funnel analytics aren't poisoned.
   198	      const upgradePlan = deriveUpgradePlan(currentPlan, reason);
   199	      trackEvent('limit_hit', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
   200	      trackEvent('paywall_opened', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
   201	      onShowPaywall(reason);
   202	      return;
   203	    }
   204	
   205	    if (status === 409 || code === 'DOCUMENT_PROCESSING') {
   206	      addMessage({
   207	        id: `m_${Date.now()}_proc`,
   208	        role: 'assistant',
   209	        text: t('doc.processing'),
   210	        createdAt: Date.now(),
   211	      });
   212	      return;
   213	    }
   214	
   215	    if (
   216	      status === 429
   217	      || code === 'RATE_LIMITED'
   218	      || code === 'DEMO_SESSION_RATE_LIMITED'
   219	      || code === 'DEMO_MESSAGE_LIMIT_REACHED'
   220	      || code === 'DEMO_SESSION_LIMIT_REACHED'
   221	    ) {
   222	      trackEvent('limit_hit', { source: 'chat_stream', reason: code || 'rate_or_demo_limit' });
   223	      const isRateLimited = code === 'RATE_LIMITED'
   224	        || code === 'DEMO_SESSION_RATE_LIMITED'
   225	        || message.includes('Rate limit exceeded');
   226	      addMessage({
   227	        id: `m_${Date.now()}_limit`,
   228	        role: 'assistant',
   229	        text: isRateLimited ? t('demo.rateLimitMessage') : t('demo.limitReachedMessage'),
   230	        createdAt: Date.now(),
   231	      });
   232	      return;
   233	    }
   234	
   235	    const copy = errorCopy(err, t, tOr);
   236	    const state = useDocTalkStore.getState();
   237	    const currentMessages = state.messages;
   238	    const lastMessage = currentMessages[currentMessages.length - 1];
   239	    const lastAssistantIsEmpty = lastMessage?.role === 'assistant'
   240	      && !lastMessage.text
   241	      && !lastMessage.toolStatus
   242	      && (!lastMessage.citations || lastMessage.citations.length === 0)
   243	      && (!lastMessage.artifacts || lastMessage.artifacts.length === 0);
   244	
   245	    if (lastAssistantIsEmpty) {
   246	      state.setMessages([
   247	        ...currentMessages.slice(0, -1),
   248	        {
   249	          ...lastMessage,
   250	          text: copy.body,
   251	          isError: true,
   252	          isTruncated: false,
   253	        },
   254	      ]);
   255	      return;
   256	    }
   257	
   258	    addMessage({
   259	      id: `m_${Date.now()}_e`,
   260	      role: 'assistant',
   261	      text: copy.body,
   262	      isError: true,
   263	      createdAt: Date.now(),
   264	    });
   265	  }, [addMessage, flushPendingText, getErrorMeta, isAbortLikeError, onShowPaywall, setStreaming, t, tOr, currentPlan]);
   266	
   267	  const handleTruncated = useCallback(() => {
   268	    flushPendingText();
   269	    markLastMessageTruncated(true);
   270	  }, [flushPendingText, markLastMessageTruncated]);
     1	"use client";
     2	
     3	import React, { useEffect, useRef, useState, useCallback } from 'react';
     4	import { useRouter } from 'next/navigation';
     5	import { SendHorizontal, ArrowDown, Square, Share2 } from 'lucide-react';
     6	import { exportConversationAsMarkdown } from '../../lib/export';
     7	import type { ChatArtifact, Citation, Message } from '../../types';
     8	import { useDocTalkStore } from '../../store';
     9	import MessageBubble from './MessageBubble';
    10	import CitationCard from './CitationCard';
    11	import { useLocale } from '../../i18n';
    12	import { PaywallModal } from '../PaywallModal';
    13	import PlusMenu from './PlusMenu';
    14	import DomainModeSelector from './DomainModeSelector';
    15	import MessageErrorBoundary from './MessageErrorBoundary';
    16	import { renumberCitations } from '../../lib/citations';
    17	import { useChatStream } from '../../lib/useChatStream';
    18	import { openAuthModal } from '../../lib/auth-modal';
    19	import { errorCopy } from '../../lib/errorCopy';
    20	import { billingHref } from '../../lib/billingLinks';
    21	import { trackEvent } from '../../lib/analytics';
    22	import { withShareAnchor } from '../../lib/shareAnchors';
    23	
    24	/**
    25	 * Per-message row rendered inside the chat scroll. Memoized so the SSE
    26	 * 50ms flush cadence — which mutates only the streaming assistant message
    27	 * — doesn't force every prior message to re-run ReactMarkdown + Shiki
    28	 * (the I21 re-render storm). The parent (`ChatPanel`) passes stable
    29	 * refs: `message` comes from the Zustand store which only allocates a
    30	 * new object for the message it's mutating, and `onRegenerate` /
    31	 * `onContinue` / `onShareAnswer` are useCallback-stabilized at the panel
    32	 * level.
    33	 *
    34	 * The renumber + clone for assistant citations lives here (was at the
    35	 * top of `messages.map` before — that ran on every parent render and
    36	 * defeated `MessageBubble`'s `React.memo`). Inside this child, the
    37	 * renumber is `useMemo`'d on `message.citations` ref, so it only
    38	 * recomputes when the citations actually change.
    39	 */
    40	interface ChatMessageRowProps {
    41	  message: Message;
    42	  isStreaming: boolean;
    43	  isLastAssistant: boolean;
    44	  onCitationClick: (c: Citation) => void;
    45	  onPreviewLayoutTranslation?: (url: string, artifact: ChatArtifact) => void;
    46	  onRegenerate?: () => void;
    47	  onContinue?: () => void;
    48	  onShareAnswer?: (message: Message) => void;
    49	  isSharingAnswer: boolean;
    50	  /** True when `onShareAnswer` is the anonymous conversion-affordance handler
    51	   *  (not a working share) — the per-answer share button needs to say "Sign
    52	   *  in to share" instead of "Share this answer" so it doesn't misrepresent
    53	   *  itself to anonymous demo users. */
    54	  isAnonShareAnswer: boolean;
    55	  onTryQuoteFinder?: (topic: string) => void;
    56	}
    57	
    58	const ChatMessageRow = React.memo(function ChatMessageRow({
    59	  message,
    60	  isStreaming,
    61	  isLastAssistant,
    62	  onCitationClick,
    63	  onPreviewLayoutTranslation,
    64	  onRegenerate,
    65	  onContinue,
    66	  onShareAnswer,
    67	  isSharingAnswer,
    68	  isAnonShareAnswer,
    69	  onTryQuoteFinder,
    70	}: ChatMessageRowProps) {
    71	  const displayCitations = React.useMemo(() => {
    72	    if (message.role !== 'assistant') return undefined;
    73	    if (!message.citations || message.citations.length === 0) return undefined;
    74	    return renumberCitations(message.citations);
    75	  }, [message.citations, message.role]);
    76	
    77	  const displayMessage = React.useMemo(
    78	    () => (displayCitations ? { ...message, citations: displayCitations } : message),
    79	    [displayCitations, message]
    80	  );
    81	
    82	  const uniqueCitations = React.useMemo(() => {
    83	    if (!displayCitations || displayCitations.length === 0) return undefined;
    84	    return displayCitations
    85	      .filter((citation, index, all) => all.findIndex((item) => item.refIndex === citation.refIndex) === index)
    86	      .sort((a, b) => a.refIndex - b.refIndex);
    87	  }, [displayCitations]);
    88	
    89	  return (
    90	    <MessageErrorBoundary messageId={message.id}>
    91	      <div>
    92	        <MessageBubble
    93	          message={displayMessage}
    94	          onCitationClick={onCitationClick}
    95	          onPreviewLayoutTranslation={onPreviewLayoutTranslation}
    96	          isStreaming={isStreaming}
    97	          onRegenerate={onRegenerate}
    98	          isLastAssistant={isLastAssistant}
    99	          onContinue={onContinue}
   100	          onShareAnswer={onShareAnswer}
   101	          isSharingAnswer={isSharingAnswer}
   102	          isAnonShareAnswer={isAnonShareAnswer}
   103	          onTryQuoteFinder={onTryQuoteFinder}
   104	        />
   105	        {uniqueCitations && uniqueCitations.length > 0 && (
   106	          <div className="mt-2 flex flex-wrap gap-1.5 pl-0">
   107	            {uniqueCitations.map((citation) => (
   108	              <CitationCard
   109	                key={`${message.id}-${citation.refIndex}`}
   110	                refIndex={citation.refIndex}
   111	                textSnippet={citation.textSnippet}
   112	                page={citation.page}
   113	                onClick={() => onCitationClick(citation)}
   114	              />
   115	            ))}
   116	          </div>
   117	        )}
   118	      </div>
   119	    </MessageErrorBoundary>
   120	  );
   121	});
   122	
   123	interface ChatPanelProps {
   124	  sessionId: string;
   125	  onCitationClick: (c: Citation) => void;
   126	  onPreviewLayoutTranslation?: (url: string, artifact: ChatArtifact) => void;
   127	  maxUserMessages?: number;
   128	  // Document-specific questions generated by the backend in the user's locale.
   129	  // No generic fallback set: when absent, the empty state stays clean.
   130	  suggestedQuestions?: string[];
   131	  initialQuestion?: string;
   132	  onOpenSettings?: () => void;
   133	  hasCustomInstructions?: boolean;
   134	  userPlan?: string;
   135	  autoSubmitInitialQuestion?: boolean;
   136	  // Whether this surface supports custom instructions at all. Document reader
   137	  // uses it (true); collection chat doesn't (scope across multiple docs is
   138	  // undefined). Default true to preserve existing single-doc behavior.
   139	  supportsCustomInstructions?: boolean;
   140	  /** Opens the Quote Finder panel prefilled with a topic (FIX3-B chip).
   141	   * Only the document reader wires this — Quote Finder is single-document
   142	   * only, so collection chat leaves it undefined and the chip never renders. */
   143	  onTryQuoteFinder?: (topic: string) => void;
   144	}
   145	
   146	const autoSubmittedInitialQuestions = new Set<string>();
   147	
   148	export default function ChatPanel({ sessionId, onCitationClick, onPreviewLayoutTranslation, maxUserMessages, suggestedQuestions, initialQuestion, onOpenSettings, hasCustomInstructions, userPlan, autoSubmitInitialQuestion = false, supportsCustomInstructions = true, onTryQuoteFinder }: ChatPanelProps) {
   149	  const messages = useDocTalkStore((s) => s.messages);
   150	  const isStreaming = useDocTalkStore((s) => s.isStreaming);
   151	  const selectedMode = useDocTalkStore((s) => s.selectedMode);
   152	  const addMessage = useDocTalkStore((s) => s.addMessage);
   153	  const { t, tOr, locale } = useLocale();
   154	  const router = useRouter();
   155	
   156	  const [input, setInput] = useState('');
   157	  const listRef = useRef<HTMLDivElement>(null);
   158	  const textareaRef = useRef<HTMLTextAreaElement>(null);
   159	  const [showPaywall, setShowPaywall] = useState(false);
   160	  const [paywallReason, setPaywallReason] = useState<string | null>(null);
   161	
   162	  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
   163	  const plusMenuRef = useRef<HTMLDivElement>(null);
   164	  const plusMenuButtonRef = useRef<HTMLButtonElement>(null);
   165	  const initialQuestionSubmittedRef = useRef<string | null>(null);
   166	
   167	  const [showScrollBtn, setShowScrollBtn] = useState(false);
   168	
   169	  const {
   170	    sendMessage,
   171	    regenerateLastResponse,
   172	    continueGenerating,
   173	    stopStreaming,
   174	    demoRemaining,
   175	    demoLimitReached,
   176	    maxMessages,
   177	  } = useChatStream({
   178	    sessionId,
   179	    selectedMode,
   180	    locale,
   181	    t,
   182	    tOr,
   183	    maxUserMessages,
   184	    currentPlan: userPlan,
   185	    onShowPaywall: (reason) => {
   186	      setPaywallReason(reason ?? null);
   187	      setShowPaywall(true);
   188	    },
   189	    onRequireAuth: () => openAuthModal(),
   190	  });
   191	
   192	  useEffect(() => {
   193	    const el = listRef.current;
   194	    if (!el) return;
   195	
   196	    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
   197	
   198	    if (isNearBottom) {
   199	      el.scrollTo({ top: el.scrollHeight, behavior: isStreaming ? 'auto' : 'smooth' });
   200	    }
   201	
   202	    setShowScrollBtn(!isNearBottom);
   203	  }, [messages, isStreaming]);
   204	
   205	  useEffect(() => {
   206	    const ta = textareaRef.current;
   207	    if (ta) {
   208	      ta.style.height = 'auto';
   209	      ta.style.height = Math.min(ta.scrollHeight, Math.max(160, window.innerHeight * 0.4)) + 'px';
   210	    }
   211	  }, [input]);
   212	
   213	  useEffect(() => {
   214	    const hasConversationMessages = messages.some((message) => message.id !== 'summary_synthetic');
   215	    if (!initialQuestion || hasConversationMessages || isStreaming) return;
   216	
   217	    if (autoSubmitInitialQuestion) {
   218	      const autoSubmitKey = `${sessionId}:${initialQuestion}`;
   219	      if (
   220	        initialQuestionSubmittedRef.current === initialQuestion
   221	        || autoSubmittedInitialQuestions.has(autoSubmitKey)
   222	      ) return;
   223	      initialQuestionSubmittedRef.current = initialQuestion;
   224	      autoSubmittedInitialQuestions.add(autoSubmitKey);
   225	      void sendMessage(initialQuestion).then((sent) => {
   226	        if (!sent) {
   227	          initialQuestionSubmittedRef.current = null;
   228	          autoSubmittedInitialQuestions.delete(autoSubmitKey);
   229	          setInput(initialQuestion);
   230	          textareaRef.current?.focus();
   231	        }
   232	      });
   233	      return;
   234	    }
   235	
   236	    if (input) return;
   237	    setInput(initialQuestion);
   238	    textareaRef.current?.focus();
   239	  }, [autoSubmitInitialQuestion, initialQuestion, input, messages, isStreaming, sendMessage, sessionId]);
   240	
   241	  useEffect(() => {
   242	    if (!plusMenuOpen) return;
   243	    const handler = (e: MouseEvent) => {
   244	      const target = e.target as HTMLElement;
   245	      if (!target.closest('[data-plus-menu]')) {
   246	        setPlusMenuOpen(false);
   247	      }
   248	    };
   249	    document.addEventListener('mousedown', handler);
   250	    return () => document.removeEventListener('mousedown', handler);
   251	  }, [plusMenuOpen]);
   252	
   253	  useEffect(() => {
   254	    if (!plusMenuOpen) return;
   255	    const frame = window.requestAnimationFrame(() => {
   256	      plusMenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
   257	    });
   258	    return () => window.cancelAnimationFrame(frame);
   259	  }, [plusMenuOpen]);
   260	
   261	  const handleScroll = useCallback(() => {
   262	    const el = listRef.current;
   263	    if (!el) return;
   264	    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
   265	    setShowScrollBtn(!atBottom);
   266	  }, []);
   267	
   268	  const handlePlusMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
   269	    const menuItems = plusMenuRef.current
   270	      ? Array.from(plusMenuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'))
   271	      : [];
   272	    if (menuItems.length === 0) return;
   273	
   274	    const activeIndex = menuItems.findIndex((item) => item === document.activeElement);
   275	
   276	    if (e.key === 'Escape') {
   277	      e.preventDefault();
   278	      setPlusMenuOpen(false);
   279	      plusMenuButtonRef.current?.focus();
   280	      return;
   281	    }
   282	
   283	    if (e.key === 'ArrowDown') {
   284	      e.preventDefault();
   285	      const nextIndex = activeIndex >= 0 ? (activeIndex + 1) % menuItems.length : 0;
   286	      menuItems[nextIndex]?.focus();
   287	      return;
   288	    }
   289	
   290	    if (e.key === 'ArrowUp') {
   291	      e.preventDefault();
   292	      const prevIndex = activeIndex >= 0
   293	        ? (activeIndex - 1 + menuItems.length) % menuItems.length
   294	        : menuItems.length - 1;
   295	      menuItems[prevIndex]?.focus();
   296	      return;
   297	    }
   298	
   299	    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement instanceof HTMLElement) {
   300	      if (document.activeElement.getAttribute('role') === 'menuitem') {
     1	"use client";
     2	
     3	import React from 'react';
     4	import { MessageSquare, Plus } from 'lucide-react';
     5	import type { SessionItem } from '../../types';
     6	import { useLocale } from '../../i18n';
     7	
     8	interface SessionListProps {
     9	  sessions: SessionItem[];
    10	  activeSessionId: string | null;
    11	  onSelectSession: (id: string) => void;
    12	  onNewSession: () => void;
    13	}
    14	
    15	export default function SessionList({ sessions, activeSessionId, onSelectSession, onNewSession }: SessionListProps) {
    16	  const { tOr } = useLocale();
    17	
    18	  return (
    19	    <div className="flex h-full flex-col">
    20	      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
    21	        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
    22	          {tOr('collections.sessions', 'Sessions')} ({sessions.length})
    23	        </h3>
    24	      </div>
    25	      <div className="flex-1 space-y-1 overflow-y-auto p-2">
    26	        {sessions.map((s) => (
    27	          <button
    28	            type="button"
    29	            key={s.session_id}
    30	            onClick={() => onSelectSession(s.session_id)}
    31	            className={`flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg ${
    32	              s.session_id === activeSessionId
    33	                ? 'bg-accent-light text-accent'
    34	                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
    35	            }`}
    36	          >
    37	            <MessageSquare size={14} className="text-zinc-400 shrink-0" />
    38	            <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
    39	              {s.title || tOr('collections.chatFallback', 'Chat ({count} msgs)', { count: s.message_count })}
    40	            </span>
    41	          </button>
    42	        ))}
    43	        {sessions.length === 0 && (
    44	          <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-center dark:border-zinc-700">
    45	            <MessageSquare aria-hidden="true" size={20} className="mx-auto mb-2 text-zinc-400" />
    46	            <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
    47	              {tOr('collections.noSessionsYet', 'No chats yet. Start a new session.')}
    48	            </p>
    49	          </div>
    50	        )}
    51	      </div>
    52	      <div className="border-t border-zinc-200 p-2 dark:border-zinc-800">
    53	        <button
    54	          type="button"
    55	          onClick={onNewSession}
    56	          className="flex w-full items-center justify-center gap-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg"
    57	        >
    58	          <Plus size={12} /> {tOr('collections.newChat', 'New chat')}
    59	        </button>
    60	      </div>
    61	    </div>
    62	  );
    63	}
   160	}
   161	
   162	export interface SearchResult {
   163	  chunk_id: string;
   164	  page: number;
   165	  text_snippet: string;
   166	  score: number;
   167	  bboxes?: NormalizedBBox[];
   168	}
   169	
   170	export interface SearchResponse {
   171	  results: SearchResult[];
   172	}
   173	
   174	export interface SessionItem {
   175	  session_id: string;
   176	  title: string | null;
   177	  message_count: number;
   178	  created_at: string;
   179	  last_activity_at: string;
   180	}
   181	
   182	export interface SessionListResponse {
   183	  sessions: SessionItem[];
   184	}
   185	
   186	export interface BillingState {
   187	  managed_by: 'stripe' | 'admin' | 'none';
   188	  can_cancel: boolean;
   189	  interval: 'month' | 'year' | null;
   190	  period_end: string | null;
   191	  cancel_at_period_end: boolean;
   192	  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'pending' | 'none';
   193	}
   194	
   195	export interface UserProfile {
   196	  id: string;
   197	  email: string;
   198	  name: string | null;
   199	  image: string | null;
   200	  created_at: string;
   201	  plan: 'free' | 'plus' | 'pro';
   202	  credits_balance: number;
   203	  monthly_allowance: number;
   204	  monthly_credits_granted_at: string | null;
   205	  signup_bonus_granted: boolean;
frontend/src/store/index.ts:57:  // instead of double-counting. See useChatStream.ts / useChatSession.ts.
frontend/src/store/index.ts:59:  // Both fields are reset ONLY inside useChatSession's documentId-keyed
frontend/src/lib/useChatSession.ts:12:export function useChatSession(documentId: string | undefined): UseChatSessionResult {
frontend/src/lib/useChatStream.ts:143:        // e.g. useChatSession's effect ran its synchronous reset for a NEW
frontend/src/lib/demoSessionStorage.ts:4: * `createSession` (5-per-5min IP cap; see useChatSession.ts). All operations
frontend/src/components/SessionDropdown.tsx:73:        // Fresh session, empty transcript — same contract as useChatSession's
frontend/src/components/SessionDropdown.tsx:107:    // Same restore contract as useChatSession's reuse branch: switching to a
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:20:import { useChatSession } from '../../../lib/useChatSession';
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:82:  const { sessionError } = useChatSession(documentId);

exec
/bin/zsh -lc "nl -ba frontend/src/store/index.ts | sed -n '330,395p'
nl -ba frontend/src/lib/useChatSession.ts | sed -n '1,230p'
nl -ba frontend/src/components/SessionDropdown.tsx | sed -n '1,220p'
nl -ba frontend/src/app/collections/[collectionId]/page.tsx | sed -n '260,430p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   330	    set({ messages: [...msgs.slice(0, -1), { ...last, ...updates }] });
   331	  },
   332	  // Clears only the per-document UI state that should NOT leak across a
   333	  // document switch (search query/matches, citation highlights, grab mode,
   334	  // current page). Call this from `useDocumentLoader` when the route changes
   335	  // from `/d/A` to `/d/B`, so doc B doesn't inherit doc A's overlays.
   336	  // Leaves session/messages/mode/sessions/userPlan intact — those are owned by
   337	  // higher-level effects that load per-document or are user-global.
   338	  clearDocumentTransientState: () => set({
   339	    searchQuery: '',
   340	    searchMatches: [],
   341	    currentMatchIndex: -1,
   342	    highlights: [],
   343	    highlightSnippet: null,
   344	    highlightFocus: null,
   345	    grabMode: false,
   346	    currentPage: 1,
   347	    scrollNonce: 0,
   348	    // Per-document content — doc B must never show doc A's summary or
   349	    // suggested questions (the loader re-sets them when B is ready).
   350	    documentSummary: null,
   351	    suggestedQuestions: [],
   352	  }),
   353	  reset: () => {
   354	    const timer = get()._flushTimer;
   355	    if (timer) clearTimeout(timer);
   356	    set((state) => ({
   357	      ...initialState,
   358	      selectedMode: state.selectedMode,
   359	      lastDocumentId: state.lastDocumentId,
   360	      lastDocumentName: state.lastDocumentName,
   361	      // demoAccountingEpoch must be monotonic ACROSS resets too, not just
   362	      // within one document's lifetime (Codex r5): restoring it to
   363	      // initialState's 0 let a pending reanchorDemoCounter GET from before
   364	      // a Back-Home reset() survive it, then match again after the epoch
   365	      // climbed back up from 0 during a later re-adopt — an ABA collision
   366	      // that let stale pre-reset accounting overwrite a newer session's
   367	      // truth. Incrementing (never resetting) guarantees every epoch value
   368	      // is used at most once, ever, so no pre-reset snapshot can ever
   369	      // collide with a post-reset value again.
   370	      demoAccountingEpoch: state.demoAccountingEpoch + 1,
   371	    }));
   372	  },
   373	}));
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
    22	    bumpDemoAccountingEpoch,
    23	    addSession,
    24	  } = useDocTalkStore();
    25	
    26	  useEffect(() => {
    27	    if (!documentId || documentStatus !== 'ready') return;
    28	
    29	    setSessionError(null);
    30	    // Reset the demo counter baseline synchronously here — NOT in
    31	    // clearDocumentTransientState (Codex r2 #2 finding: that function is
    32	    // ALSO invoked by useDocumentLoader's effect, whose deps include the
    33	    // locale-sensitive `t`/`tOr`, so a same-document language change would
    34	    // zero the counter while the transcript stayed, reintroducing the
    35	    // TTL-hard-lock bug). This effect's own deps (below) exclude locale —
    36	    // it only reruns on a real documentId transition — and always
    37	    // re-establishes server truth right after via adopt-or-create in the
    38	    // same run, so the momentary reset here is safe.
    39	    setDemoMessagesUsed(0);
    40	    setDemoRestoredUserMsgCount(0);
    41	    // Bump the accounting epoch on every reset — see the field's doc comment
    42	    // in store/index.ts. A reanchorDemoCounter GET issued before this reset
    43	    // (e.g. for the PREVIOUS document's session) must never be allowed to
    44	    // write over whatever this run establishes, even in the (currently
    45	    // impossible, but not worth relying on) case its own sessionId happened
    46	    // to collide.
    47	    bumpDemoAccountingEpoch();
    48	    // Clear the PREVIOUS document's session/messages/sessions synchronously
    49	    // too (Codex r3 breakage 3), not just the counter. Without this, a
    50	    // transient adoption failure for document B left document A's still-
    51	    // truthy sessionId/messages sitting in the store; DocumentReaderPageClient
    52	    // renders `documentStatus === 'ready' && sessionId ? <ChatPanel/> :
    53	    // sessionErrorCopy ? <error/> : ...` — checking sessionId BEFORE the
    54	    // error — so it kept showing A's stale chat instead of B's retryable
    55	    // error. This also closes a pre-existing (unrelated) stale-chat flash on
    56	    // any in-app document transition, since A's session/messages previously
    57	    // lingered in the store until B's adopt/create resolved. The brief
    58	    // sessionId===null window this creates renders a benign "initializing
    59	    // chat" placeholder (DocumentReaderPageClient's final else branch), not
    60	    // a blank/broken state.
    61	    setSessionId(null);
    62	    setMessages([]);
    63	    setSessions([]);
    64	    let cancelled = false;
    65	
    66	    (async () => {
    67	      let sessionReady = false;
    68	
    69	      // Anonymous demo: re-adopt the session we created earlier this browser
    70	      // session instead of burning a create per page view (5-per-5min IP cap).
    71	      // Safe for authed users too: if a signed-in caller inherits a stale key
    72	      // from an earlier anonymous visit, `getMessages` 404s for them (the
    73	      // session is anon-owned; `verify_session_access` in chat.py:157-163
    74	      // only returns it to `user is None` callers), so the catch below
    75	      // clears the key and falls through to the normal listSessions flow.
    76	      const storedDemoSession = readDemoSession(documentId);
    77	      if (storedDemoSession) {
    78	        try {
    79	          const msgsData = await getMessages(storedDemoSession);
    80	          if (cancelled) return;
    81	          setSessionId(storedDemoSession);
    82	          // Populate the sessions list (not []) so SessionDropdown shows the
    83	          // adopted session instead of an empty "New Chat"-only placeholder.
    84	          // getMessages doesn't return session metadata, so derive
    85	          // created_at/last_activity_at from the fetched messages' own
    86	          // timestamps (falling back to now if there are none yet).
    87	          const firstMsgAt = msgsData.messages[0]?.createdAt;
    88	          const lastMsgAt = msgsData.messages[msgsData.messages.length - 1]?.createdAt;
    89	          const createdAt = firstMsgAt != null ? new Date(firstMsgAt).toISOString() : new Date().toISOString();
    90	          const lastActivityAt = lastMsgAt != null ? new Date(lastMsgAt).toISOString() : createdAt;
    91	          setSessions([{
    92	            session_id: storedDemoSession,
    93	            title: null,
    94	            message_count: msgsData.messages.length,
    95	            created_at: createdAt,
    96	            last_activity_at: lastActivityAt,
    97	          }]);
    98	          setMessages(msgsData.messages);
    99	          // Baseline model (useChatStream.ts): totalUsed = demoMessagesUsed
   100	          // (server-known usage AS OF THIS RESTORE) + messages sent locally
   101	          // since then. demoRestoredUserMsgCount records how many of the
   102	          // transcript's user messages are already covered by
   103	          // demoMessagesUsed, so useChatStream only counts NEW ones on top.
   104	          // demoMessagesUsed is the raw server value — NOT subtracted — so a
   105	          // restore always converges to server truth, including when the
   106	          // 24h Redis window has expired or the IP changed (server reports
   107	          // 0 even though the transcript has old messages): that previously
   108	          // made the UI hard-lock a user the backend would actually allow.
   109	          const restoredUserMsgCount = msgsData.messages.filter((m) => m.role === 'user').length;
   110	          setDemoRestoredUserMsgCount(restoredUserMsgCount);
   111	          setDemoMessagesUsed(msgsData.demo_messages_used ?? 0);
   112	          bumpDemoAccountingEpoch();
   113	          return; // adopted — skip listSessions/createSession entirely
   114	        } catch (e) {
   115	          const status = e instanceof ApiError ? e.status : null;
   116	          if (status === 404 || status === 403) {
   117	            // Confirmed gone or inaccessible (pruned by nightly cleanup, or
   118	            // an authed caller inheriting an anon-owned key) — clear the
   119	            // pointer and fall through to the normal listSessions/
   120	            // createSession flow below.
   121	            clearDemoSession(documentId);
   122	          } else {
   123	            // Transient failure (network blip, 5xx) — the pointer is still
   124	            // valid and the session most likely still exists. Falling
   125	            // through to createSession here would silently orphan it:
   126	            // listSessions always returns [] for anon demo, so createSession
   127	            // would succeed and overwrite the still-good pointer (Codex r2
   128	            // #3 repro). Surface a retryable error and stop instead — the
   129	            // reader already renders an error state for sessionError, and a
   130	            // reload re-runs this same effect from the top.
   131	            if (!cancelled) setSessionError(e);
   132	            return;
   133	          }
   134	        }
   135	      }
   136	
   137	      try {
   138	        const sessionsData = await listSessions(documentId);
   139	        if (cancelled) return;
   140	
   141	        setSessions(sessionsData.sessions);
   142	        if (sessionsData.sessions.length > 0) {
   143	          const latest = sessionsData.sessions[0];
   144	          setSessionId(latest.session_id);
   145	          const msgsData = await getMessages(latest.session_id);
   146	          if (!cancelled) setMessages(msgsData.messages);
   147	          sessionReady = true;
   148	        }
   149	      } catch (e) {
   150	        console.warn('Failed to load sessions, falling back to create:', e);
   151	      }
   152	
   153	      if (!sessionReady && !cancelled) {
   154	        try {
   155	          const s = await createSession(documentId);
   156	          if (cancelled) return;
   157	
   158	          setSessionId(s.session_id);
   159	          if (s.demo_messages_used != null) {
   160	            // Fresh session, empty transcript — nothing restored yet, so the
   161	            // baseline is 0 and every subsequent local user message counts.
   162	            setDemoRestoredUserMsgCount(0);
   163	            setDemoMessagesUsed(s.demo_messages_used);
   164	            bumpDemoAccountingEpoch();
   165	            writeDemoSession(documentId, s.session_id);
   166	          }
   167	
   168	          const now = s.created_at || new Date().toISOString();
   169	          addSession({
   170	            session_id: s.session_id,
   171	            title: null,
   172	            message_count: 0,
   173	            created_at: now,
   174	            last_activity_at: now,
   175	          });
   176	
   177	          setMessages([]);
   178	        } catch (e) {
   179	          const expectedRateLimit = e instanceof ApiError && (e.code === 'DEMO_SESSION_RATE_LIMITED' || e.status === 429);
   180	          if (!expectedRateLimit) {
   181	            console.error('Failed to create session:', e);
   182	          }
   183	          if (!cancelled) setSessionError(e);
   184	        }
   185	      }
   186	    })();
   187	
   188	    return () => {
   189	      cancelled = true;
   190	    };
   191	  }, [documentId, documentStatus, setSessions, setSessionId, setMessages, setDemoMessagesUsed, setDemoRestoredUserMsgCount, bumpDemoAccountingEpoch, addSession]);
   192	
   193	  return { sessionError };
   194	}
     1	"use client";
     2	
     3	import { useEffect, useMemo, useRef, useState } from 'react';
     4	import { ChevronDown, Plus, Trash2, Home, X } from 'lucide-react';
     5	import Link from 'next/link';
     6	import { useRouter } from 'next/navigation';
     7	import { useDocTalkStore } from '../store';
     8	import { useLocale } from '../i18n';
     9	import { createSession, getMessages, deleteSession } from '../lib/api';
    10	import { errorCopy, type ErrorCopy } from '../lib/errorCopy';
    11	import { trackEvent } from '../lib/analytics';
    12	import { useDropdownKeyboard } from '../lib/useDropdownKeyboard';
    13	import { clearDemoSession, readDemoSession, writeDemoSession } from '../lib/demoSessionStorage';
    14	
    15	export default function SessionDropdown() {
    16	  const documentName = useDocTalkStore((s) => s.documentName);
    17	  const documentId = useDocTalkStore((s) => s.documentId);
    18	  const sessionId = useDocTalkStore((s) => s.sessionId);
    19	  const sessions = useDocTalkStore((s) => s.sessions);
    20	  const isStreaming = useDocTalkStore((s) => s.isStreaming);
    21	
    22	  const { addSession, setSessionId, setMessages, removeSession, reset, setDemoMessagesUsed, setDemoRestoredUserMsgCount, bumpDemoAccountingEpoch } = useDocTalkStore();
    23	  const { t, tOr } = useLocale();
    24	  const router = useRouter();
    25	
    26	  const [open, setOpen] = useState(false);
    27	  const [focusIndex, setFocusIndex] = useState(-1);
    28	  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    29	  const [sessionErrorCopy, setSessionErrorCopy] = useState<ErrorCopy | null>(null);
    30	  const ref = useRef<HTMLDivElement>(null);
    31	  const triggerRef = useRef<HTMLButtonElement>(null);
    32	  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
    33	
    34	  useEffect(() => {
    35	    function onDocClick(e: MouseEvent) {
    36	      if (!ref.current) return;
    37	      if (!ref.current.contains(e.target as Node)) setOpen(false);
    38	    }
    39	    document.addEventListener('mousedown', onDocClick);
    40	    return () => document.removeEventListener('mousedown', onDocClick);
    41	  }, []);
    42	
    43	  useEffect(() => {
    44	    if (open) {
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
    77	        // This install is itself an accounting-relevant event — bump so a
    78	        // pending reanchorDemoCounter GET from before this "New Chat" (e.g.
    79	        // a failed regenerate on whatever session was active) can't clobber
    80	        // it (Codex r5: relying on the sessionId change alone was judged
    81	        // fragile enough to bump unconditionally here too).
    82	        bumpDemoAccountingEpoch();
    83	        // "New Chat" for an anon demo user starts a NEW session — the stored
    84	        // pointer must move to it, or the next page view re-adopts the old
    85	        // (now-abandoned) session instead of this one.
    86	        writeDemoSession(documentId, s.session_id);
    87	      }
    88	      setMessages([]);
    89	      setConfirmDeleteId(null);
    90	      setOpen(false);
    91	    } catch (e) {
    92	      const copy = errorCopy(e, t, tOr);
    93	      setSessionErrorCopy(copy);
    94	      if (copy.cta) {
    95	        trackEvent('limit_hit', { source: 'session_dropdown', reason: 'session_limit' });
    96	      }
    97	    }
    98	  };
    99	
   100	  const onSwitchSession = async (id: string) => {
   101	    if (isStreaming) return;
   102	    setSessionErrorCopy(null);
   103	    setMessages([]);
   104	    setSessionId(id);
   105	    const msgs = await getMessages(id);
   106	    setMessages(msgs.messages);
   107	    // Same restore contract as useChatSession's reuse branch: switching to a
   108	    // session with a real transcript must reset the baseline to what THIS
   109	    // transcript carries, or the demo counter stays misaligned against the
   110	    // newly-loaded messages (only relevant when `id` is an anon demo session
   111	    // — demo_messages_used is absent for authed/non-demo sessions).
   112	    if (msgs.demo_messages_used != null) {
   113	      const restoredUserMsgCount = msgs.messages.filter((m) => m.role === 'user').length;
   114	      setDemoRestoredUserMsgCount(restoredUserMsgCount);
   115	      setDemoMessagesUsed(msgs.demo_messages_used);
   116	      // This install is itself an accounting-relevant event — bump so a
   117	      // pending reanchorDemoCounter GET can't clobber it. Required (not
   118	      // just defensive) here specifically: the current session row stays
   119	      // clickable, so an A→A "switch" — or A→B→A — can install fresh
   120	      // accounting without ever changing sessionId, which the existing
   121	      // sessionId guard alone cannot detect (Codex r5).
   122	      bumpDemoAccountingEpoch();
   123	      // Switching to a different anon-demo session moves the "active"
   124	      // session — move the pointer too, so the next page view re-adopts
   125	      // the one the user actually switched to, not the one they left.
   126	      if (documentId) writeDemoSession(documentId, id);
   127	    }
   128	    setConfirmDeleteId(null);
   129	    setOpen(false);
   130	  };
   131	
   132	  const onDeleteSessionById = async (targetId: string) => {
   133	    if (isStreaming) return;
   134	    setSessionErrorCopy(null);
   135	    setConfirmDeleteId(null);
   136	    await deleteSession(targetId);
   137	    removeSession(targetId);
   138	    // Clear the stored anon-demo pointer IMMEDIATELY on confirmed delete, if
   139	    // it named this session — before any replacement GET below. Otherwise a
   140	    // transient failure in onSwitchSession/onNewChat would leave the
   141	    // pointer naming a session that no longer exists (Codex r2 #3): the
   142	    // next page load would 404 on adopt, which is a safe fallback, but only
   143	    // clearing it here proactively avoids that extra failed round-trip. A
   144	    // successful switch/create afterward writes the new pointer over this.
   145	    if (documentId && readDemoSession(documentId) === targetId) {
   146	      clearDemoSession(documentId);
   147	    }
   148	    const remaining = useDocTalkStore.getState().sessions;
   149	    if (targetId === sessionId) {
   150	      if (remaining.length > 0) {
   151	        await onSwitchSession(remaining[0].session_id);
   152	      } else {
   153	        await onNewChat();
   154	      }
   155	    }
   156	    setOpen(false);
   157	  };
   158	
   159	  const onDeleteCurrent = () => {
   160	    if (!sessionId || isStreaming) return;
   161	    setSessionErrorCopy(null);
   162	    setConfirmDeleteId(sessionId);
   163	  };
   164	
   165	  const requestDeleteSession = (targetId: string) => {
   166	    if (isStreaming) return;
   167	    setSessionErrorCopy(null);
   168	    setConfirmDeleteId(targetId);
   169	  };
   170	
   171	  const onBackHome = () => {
   172	    router.push('/');
   173	    reset();
   174	  };
   175	
   176	  const disabledClass = isStreaming ? 'opacity-60 cursor-not-allowed' : '';
   177	
   178	  const titleText = documentName || '';
   179	  const sortedSessions = useMemo(() => sessions.slice(0, 10), [sessions]);
   180	
   181	  // Total items: 1 (New Chat) + sessions + 1 (Delete) + 1 (Back Home)
   182	  const totalItems = 1 + sortedSessions.length + 2;
   183	
   184	  const handleMenuSelect = (index: number) => {
   185	    if (index === 0) {
   186	      void onNewChat();
   187	      return;
   188	    }
   189	    if (index >= 1 && index <= sortedSessions.length) {
   190	      const selected = sortedSessions[index - 1];
   191	      if (selected) void onSwitchSession(selected.session_id);
   192	      return;
   193	    }
   194	    if (index === 1 + sortedSessions.length) {
   195	      onDeleteCurrent();
   196	      return;
   197	    }
   198	    if (index === 2 + sortedSessions.length) {
   199	      onBackHome();
   200	    }
   201	  };
   202	
   203	  const handleMenuKeyDown = useDropdownKeyboard(
   204	    totalItems,
   205	    focusIndex,
   206	    setFocusIndex,
   207	    handleMenuSelect,
   208	    () => {
   209	      setOpen(false);
   210	      triggerRef.current?.focus();
   211	    },
   212	  );
   213	
   214	  return (
   215	    <div className="relative min-w-0" ref={ref}>
   216	      <button
   217	        ref={triggerRef}
   218	        type="button"
   219	        onClick={toggle}
   220	        data-tour="session-dropdown"
zsh:4: no matches found: frontend/src/app/collections/[collectionId]/page.tsx

exec
/bin/zsh -lc 'git diff ba8a141..HEAD -- frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx frontend/src/components/Chat/ChatArtifactCard.tsx frontend/src/components/Chat/ChatPanel.tsx frontend/src/components/Extraction/ExtractionPanel.tsx frontend/src/components/PaywallModal.tsx frontend/src/lib/billingLinks.ts frontend/src/lib/errorCopy.ts frontend/src/lib/useChatStream.ts frontend/src/i18n/locales/en.json
git show --stat --oneline 4cd4c8a 78f660b 28c0977 1a2dcc8 1fab067
git show --format=fuller --no-ext-diff 1fab067 -- backend/app/api/chat.py backend/app/api/extractions.py frontend/src/lib/errorCopy.ts' in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
zsh:1: no matches found: frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx
4cd4c8a fix: surface SHARE_LIMIT_REACHED upgrade CTA in chat share errors
 frontend/src/components/Chat/ChatPanel.tsx | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
78f660b fix: surface DOCUMENT_LIMIT_REACHED upgrade CTA in layout-translation submit
 .../app/d/[documentId]/DocumentReaderPageClient.tsx | 21 ++++++++++++++++-----
 1 file changed, 16 insertions(+), 5 deletions(-)
28c0977 fix: surface DOCUMENT_LIMIT_REACHED upgrade CTA in layout-translation import
 frontend/src/components/Chat/ChatArtifactCard.tsx | 20 ++++++++++++++++----
 1 file changed, 16 insertions(+), 4 deletions(-)
1a2dcc8 feat: add DOMAIN_MODE_REQUIRES_PLUS upgrade path (chat + REST extraction)
 frontend/src/components/Extraction/ExtractionPanel.tsx | 4 +++-
 frontend/src/components/PaywallModal.tsx               | 9 +++++++++
 frontend/src/i18n/locales/ar.json                      | 6 ++++++
 frontend/src/i18n/locales/de.json                      | 6 ++++++
 frontend/src/i18n/locales/en.json                      | 6 ++++++
 frontend/src/i18n/locales/es.json                      | 6 ++++++
 frontend/src/i18n/locales/fr.json                      | 6 ++++++
 frontend/src/i18n/locales/hi.json                      | 6 ++++++
 frontend/src/i18n/locales/it.json                      | 6 ++++++
 frontend/src/i18n/locales/ja.json                      | 6 ++++++
 frontend/src/i18n/locales/ko.json                      | 6 ++++++
 frontend/src/i18n/locales/pt.json                      | 6 ++++++
 frontend/src/i18n/locales/zh.json                      | 6 ++++++
 frontend/src/lib/billingLinks.ts                       | 5 ++++-
 frontend/src/lib/errorCopy.ts                          | 7 +++++++
 frontend/src/lib/useChatStream.ts                      | 1 +
 16 files changed, 90 insertions(+), 2 deletions(-)
1fab067 fix: drop stray openPaywall on DOMAIN_MODE_REQUIRES_PLUS, fix rule doc
 .claude/rules/frontend.md     | 2 +-
 frontend/src/lib/errorCopy.ts | 1 -
 2 files changed, 1 insertion(+), 2 deletions(-)
commit 1fab0679aa0896feb8659a0e9bfa30618a8c3e34
Author:     Yijie Ma <mayijie@Mac.fritz.box>
AuthorDate: Mon Aug 3 23:31:26 2026 +0200
Commit:     Yijie Ma <mayijie@Mac.fritz.box>
CommitDate: Mon Aug 3 23:31:26 2026 +0200

    fix: drop stray openPaywall on DOMAIN_MODE_REQUIRES_PLUS, fix rule doc
    
    errorCopy.ts's openPaywall field is documented as reserved for 402
    credit/mode paywalls and SSE MODE_NOT_ALLOWED — every other plan-limit
    403 uses inline CTA only. DOMAIN_MODE_REQUIRES_PLUS is structurally
    identical to DOCUMENT_LIMIT_REACHED/SESSION_LIMIT_REACHED/
    SHARE_LIMIT_REACHED (none of which set the flag); the chat-path modal
    trigger is handled separately by useChatStream's own hardcoded list,
    making the flag redundant here and a latent trap for any future
    generic errorCopy() consumer that trusts the JSDoc. Confirmed zero
    current consumers via grep before removing.
    
    Also corrects .claude/rules/frontend.md's Domain Mode gating line,
    which credited only chat.py — extractions.py's create_extraction
    gained the same 403 gate in ef7e798 and was missing from the doc.
    
    Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

diff --git a/frontend/src/lib/errorCopy.ts b/frontend/src/lib/errorCopy.ts
index cf3c254..9c970cd 100644
--- a/frontend/src/lib/errorCopy.ts
+++ b/frontend/src/lib/errorCopy.ts
@@ -280,7 +280,6 @@ const CODE_TABLE: Record<string, Handler> = {
     body: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.body', 'Legal and Academic domain mode is available on the Plus plan.'),
     cta: requiredPlanCta(d, tOr, 'domain_mode'),
     severity: 'warning',
-    openPaywall: true,
   }),
 
   // ─── Collections ───

exec
/bin/zsh -lc "git diff ba8a141..HEAD -- 'frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx' frontend/src/components/Chat/ChatArtifactCard.tsx frontend/src/components/Chat/ChatPanel.tsx frontend/src/components/Extraction/ExtractionPanel.tsx frontend/src/components/PaywallModal.tsx frontend/src/lib/billingLinks.ts frontend/src/lib/errorCopy.ts frontend/src/lib/useChatStream.ts frontend/src/i18n/locales/en.json
nl -ba frontend/src/lib/errorCopy.ts | sed -n '1,340p'
nl -ba frontend/src/lib/billingLinks.ts | sed -n '1,220p'
nl -ba frontend/src/components/PaywallModal.tsx | sed -n '1,260p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
diff --git a/frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx b/frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx
index f583ab5..242dac5 100644
--- a/frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx
+++ b/frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx
@@ -19,7 +19,7 @@ import QuoteFinderPanel from '../../../components/Quotes/QuoteFinderPanel';
 import { useDocumentLoader } from '../../../lib/useDocumentLoader';
 import { useChatSession } from '../../../lib/useChatSession';
 import { useUserPlanProfile } from '../../../lib/useUserPlanProfile';
-import { errorCopy } from '../../../lib/errorCopy';
+import { errorCopy, type ErrorCopy } from '../../../lib/errorCopy';
 import { openAuthModal } from '../../../lib/auth-modal';
 import type { ChatArtifact, Citation } from '../../../types';
 import { trackEvent } from '../../../lib/analytics';
@@ -57,7 +57,7 @@ export default function DocumentReaderPageClient() {
   const [showInstructions, setShowInstructions] = useState(false);
   const [layoutTranslationBusy, setLayoutTranslationBusy] = useState(false);
   const [layoutTranslationDrawerOpen, setLayoutTranslationDrawerOpen] = useState(false);
-  const [layoutTranslationError, setLayoutTranslationError] = useState<string | null>(null);
+  const [layoutTranslationError, setLayoutTranslationError] = useState<ErrorCopy | null>(null);
   const [layoutPaywallOpen, setLayoutPaywallOpen] = useState(false);
   const [layoutPaywallReason, setLayoutPaywallReason] = useState<string | null>(null);
   const [quoteFinderOpen, setQuoteFinderOpen] = useState(false);
@@ -202,8 +202,7 @@ export default function DocumentReaderPageClient() {
           period: 'monthly',
         });
       } else {
-        const copy = errorCopy(err, t, tOr);
-        setLayoutTranslationError(`${copy.title}: ${copy.body}`);
+        setLayoutTranslationError(errorCopy(err, t, tOr));
         setLayoutTranslationDrawerOpen(false);
       }
     } finally {
@@ -297,7 +296,19 @@ export default function DocumentReaderPageClient() {
       {layoutTranslationError ? (
         <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
           <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
-          <span className="min-w-0 flex-1">{layoutTranslationError}</span>
+          <span className="min-w-0 flex-1">
+            <span className="font-medium">{layoutTranslationError.title}: </span>
+            {layoutTranslationError.body}
+            {layoutTranslationError.cta && (
+              <button
+                type="button"
+                onClick={() => router.push(layoutTranslationError.cta!.href)}
+                className="ml-2 font-medium underline decoration-amber-500 underline-offset-2 hover:text-amber-700 dark:hover:text-amber-50"
+              >
+                {layoutTranslationError.cta.label}
+              </button>
+            )}
+          </span>
           <button
             type="button"
             onClick={() => setLayoutTranslationError(null)}
diff --git a/frontend/src/components/Chat/ChatArtifactCard.tsx b/frontend/src/components/Chat/ChatArtifactCard.tsx
index ccb6ba0..89880a8 100644
--- a/frontend/src/components/Chat/ChatArtifactCard.tsx
+++ b/frontend/src/components/Chat/ChatArtifactCard.tsx
@@ -1,11 +1,13 @@
 "use client";
 
 import { useEffect, useMemo, useRef, useState } from 'react';
+import Link from 'next/link';
 import { AlertTriangle, CheckCircle2, Clock3, Download, ExternalLink, Eye, FilePlus2, FileText, Languages, Loader2, Quote, RefreshCw, Sparkles, Table2 } from 'lucide-react';
 import type { ChatArtifact, Citation, DocumentTable, QuoteCardsArtifactPreview } from '../../types';
 import { getDocumentJob, getTableScanJob, importLayoutTranslationDocument, listDocumentTables, reconstructDocumentTable } from '../../lib/api';
 import type { QuoteCard } from '../../lib/api';
 import { absoluteProxiedArtifactUrl, proxiedArtifactUrl } from '../../lib/layoutTranslation';
+import { errorCopy, type ErrorCopy } from '../../lib/errorCopy';
 import { useLocale } from '../../i18n';
 import { useDocTalkStore } from '../../store';
 import QuoteCardList from '../Quotes/QuoteCardList';
@@ -98,13 +100,13 @@ function tableMethodLabel(method: unknown, tOr: (key: string, fallback: string,
 }
 
 export default function ChatArtifactCard({ artifact, onCitationClick, onPreviewLayoutTranslation }: ChatArtifactCardProps) {
-  const { tOr, locale } = useLocale();
+  const { t, tOr, locale } = useLocale();
   const [current, setCurrent] = useState(artifact);
   const [tableJob, setTableJob] = useState<{ id: string; status: string; tableId: string } | null>(null);
   const [rebuildingTableId, setRebuildingTableId] = useState<string | null>(null);
   const [tableRebuildError, setTableRebuildError] = useState<string | null>(null);
   const [layoutImporting, setLayoutImporting] = useState(false);
-  const [layoutImportError, setLayoutImportError] = useState<string | null>(null);
+  const [layoutImportError, setLayoutImportError] = useState<ErrorCopy | null>(null);
   const autoImportAttemptedRef = useRef(false);
   const isPending = current.status === 'queued' || current.status === 'running';
   const isFailed = current.status === 'failed';
@@ -292,7 +294,7 @@ export default function ChatArtifactCard({ artifact, onCitationClick, onPreviewL
         },
       }));
     } catch (err) {
-      setLayoutImportError(err instanceof Error ? err.message : 'Document import failed');
+      setLayoutImportError(errorCopy(err, t, tOr));
     } finally {
       setLayoutImporting(false);
     }
@@ -330,7 +332,17 @@ export default function ChatArtifactCard({ artifact, onCitationClick, onPreviewL
             <p className="mt-2 text-xs text-red-700 dark:text-red-300">{tableRebuildError}</p>
           ) : null}
           {layoutImportError ? (
-            <p className="mt-2 text-xs text-red-700 dark:text-red-300">{layoutImportError}</p>
+            <p className="mt-2 text-xs text-red-700 dark:text-red-300">
+              {layoutImportError.title}: {layoutImportError.body}
+              {layoutImportError.cta && (
+                <Link
+                  href={layoutImportError.cta.href}
+                  className="ml-1 font-medium underline decoration-red-400 underline-offset-2 hover:text-red-800 dark:hover:text-red-100"
+                >
+                  {layoutImportError.cta.label}
+                </Link>
+              )}
+            </p>
           ) : null}
           {isLayoutTranslation && typeof layoutPreview.import_error === 'string' && layoutPreview.import_error ? (
             <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{layoutPreview.import_error}</p>
diff --git a/frontend/src/components/Chat/ChatPanel.tsx b/frontend/src/components/Chat/ChatPanel.tsx
index db011cf..84fcd3c 100644
--- a/frontend/src/components/Chat/ChatPanel.tsx
+++ b/frontend/src/components/Chat/ChatPanel.tsx
@@ -408,7 +408,7 @@ export default function ChatPanel({ sessionId, onCitationClick, onPreviewLayoutT
       addMessage({
         id: `m_${Date.now()}_share_err`,
         role: 'assistant',
-        text: copy.body,
+        text: copy.cta ? `${copy.body}\n\n[${copy.cta.label}](${copy.cta.href})` : copy.body,
         isError: true,
         createdAt: Date.now(),
       });
@@ -438,7 +438,7 @@ export default function ChatPanel({ sessionId, onCitationClick, onPreviewLayoutT
       addMessage({
         id: `m_${Date.now()}_share_answer_err`,
         role: 'assistant',
-        text: copy.body,
+        text: copy.cta ? `${copy.body}\n\n[${copy.cta.label}](${copy.cta.href})` : copy.body,
         isError: true,
         createdAt: Date.now(),
       });
diff --git a/frontend/src/components/Extraction/ExtractionPanel.tsx b/frontend/src/components/Extraction/ExtractionPanel.tsx
index d54d9d2..f7f0e8c 100644
--- a/frontend/src/components/Extraction/ExtractionPanel.tsx
+++ b/frontend/src/components/Extraction/ExtractionPanel.tsx
@@ -210,7 +210,7 @@ export default function ExtractionPanel({ documentId, onCitationClick, userPlan
         void refreshJobs().catch(() => undefined);
       }, 1200);
     } catch (err) {
-      if (err instanceof ApiError && (err.code === "INSUFFICIENT_CREDITS" || err.code === "EXTRACTION_LIMIT_REACHED")) {
+      if (err instanceof ApiError && (err.code === "INSUFFICIENT_CREDITS" || err.code === "EXTRACTION_LIMIT_REACHED" || err.code === "DOMAIN_MODE_REQUIRES_PLUS")) {
         setPaywallCode(err.code);
       } else {
         setError(err instanceof Error ? err.message : "Extraction failed");
@@ -466,6 +466,8 @@ export default function ExtractionPanel({ documentId, onCitationClick, userPlan
                   <p className="font-medium">
                     {paywallCode === "EXTRACTION_LIMIT_REACHED"
                       ? tOr("extract.limitReached", "Free extraction limit reached.")
+                      : paywallCode === "DOMAIN_MODE_REQUIRES_PLUS"
+                      ? tOr("extract.domainModeRequiresPlus", "Legal/Academic domain mode requires the Plus plan.")
                       : tOr("credits.insufficientCredits", "Insufficient Credits")}
                   </p>
                   <Link
diff --git a/frontend/src/components/PaywallModal.tsx b/frontend/src/components/PaywallModal.tsx
index e541dc4..6ecd7d7 100644
--- a/frontend/src/components/PaywallModal.tsx
+++ b/frontend/src/components/PaywallModal.tsx
@@ -31,6 +31,15 @@ function paywallCopy(reason: string | null | undefined, t: (key: string) => stri
     };
   }
 
+  if (reason === 'DOMAIN_MODE_REQUIRES_PLUS') {
+    return {
+      title: tOr('paywall.domainMode.title', 'Unlock Legal & Academic mode'),
+      body: tOr('paywall.domainMode.body', 'Legal and Academic domain mode is available on the Plus plan, tuning citations and prompts for domain-specific reading.'),
+      primaryLabel: tOr('paywall.domainMode.cta', 'Upgrade for domain mode'),
+      reason: 'domain_mode',
+    };
+  }
+
   if (reason === 'LAYOUT_TRANSLATION_LIMIT_REACHED') {
     return {
       title: tOr('paywall.layoutTranslation.title', 'Keep translating full PDFs'),
diff --git a/frontend/src/i18n/locales/en.json b/frontend/src/i18n/locales/en.json
index e9b9b27..c449e85 100644
--- a/frontend/src/i18n/locales/en.json
+++ b/frontend/src/i18n/locales/en.json
@@ -2346,6 +2346,8 @@
   "errors.CONTINUATION_LIMIT.body": "You can only continue a response {max} times.",
   "errors.MODE_NOT_ALLOWED.title": "Plus plan required",
   "errors.MODE_NOT_ALLOWED.body": "This mode is available on the Plus plan.",
+  "errors.DOMAIN_MODE_REQUIRES_PLUS.title": "Plus plan required",
+  "errors.DOMAIN_MODE_REQUIRES_PLUS.body": "Legal and Academic domain mode is available on the Plus plan.",
   "errors.COLLECTION_LIMIT_REACHED.title": "Collection limit reached",
   "errors.COLLECTION_LIMIT_REACHED.body": "Your plan allows up to {limit} collections. Upgrade for more.",
   "errors.COLLECTION_DOC_LIMIT_REACHED.title": "Too many documents",
@@ -2665,6 +2667,7 @@
   "extract.starting": "Starting...",
   "extract.run": "Run extraction",
   "extract.limitReached": "Free extraction limit reached.",
+  "extract.domainModeRequiresPlus": "Legal/Academic domain mode requires the Plus plan.",
   "extract.result": "Extraction result",
   "extract.status.succeeded": "Ready",
   "extract.status.failed": "Failed",
@@ -2689,6 +2692,9 @@
   "paywall.layoutTranslation.title": "Keep translating full PDFs",
   "paywall.layoutTranslation.body": "Free includes 2 layout-preserving PDF translations. Plus unlocks this workflow for active document work.",
   "paywall.layoutTranslation.cta": "Upgrade for PDF translation",
+  "paywall.domainMode.title": "Unlock Legal & Academic mode",
+  "paywall.domainMode.body": "Legal and Academic domain mode is available on the Plus plan, tuning citations and prompts for domain-specific reading.",
+  "paywall.domainMode.cta": "Upgrade for domain mode",
   "paywall.savedQuotes.title": "Keep saving quotes",
   "paywall.savedQuotes.body": "Free includes 30 saved quotes. Plus unlocks up to 999 for building out a full research library.",
   "paywall.savedQuotes.cta": "Upgrade to save more quotes",
diff --git a/frontend/src/lib/billingLinks.ts b/frontend/src/lib/billingLinks.ts
index c967888..ef3c02e 100644
--- a/frontend/src/lib/billingLinks.ts
+++ b/frontend/src/lib/billingLinks.ts
@@ -34,6 +34,9 @@ export function authHrefFor(path: string): string {
  *   - INSUFFICIENT_CREDITS / generic 402: Free → Plus, Plus → Pro,
  *     Pro → 'pro' (already on top plan; the funnel still rolls up under the
  *     existing plan rather than getting falsely attributed to a Plus upgrade).
+ *   - LAYOUT_TRANSLATION_LIMIT_REACHED / DOMAIN_MODE_REQUIRES_PLUS: always
+ *     'plus' — both gates are plan checks that already pass for Plus/Pro, so
+ *     they only ever fire for a free-plan user.
  *
  * Shared by `useChatStream.ts` (analytics + paywall trigger) and
  * `PaywallModal.tsx` (CTA href + click analytics) so the route the user is
@@ -43,7 +46,7 @@ export function deriveUpgradePlan(
   currentPlan: string | undefined,
   reason: string | null | undefined,
 ): BillingPlanIntent {
-  if (reason === 'LAYOUT_TRANSLATION_LIMIT_REACHED') {
+  if (reason === 'LAYOUT_TRANSLATION_LIMIT_REACHED' || reason === 'DOMAIN_MODE_REQUIRES_PLUS') {
     return 'plus';
   }
   const isProCap = reason === 'PRO_MODE_LIMIT_REACHED'
diff --git a/frontend/src/lib/errorCopy.ts b/frontend/src/lib/errorCopy.ts
index c08c241..9c970cd 100644
--- a/frontend/src/lib/errorCopy.ts
+++ b/frontend/src/lib/errorCopy.ts
@@ -275,6 +275,12 @@ const CODE_TABLE: Record<string, Handler> = {
     severity: 'warning',
     openPaywall: true,
   }),
+  DOMAIN_MODE_REQUIRES_PLUS: (d, tOr) => ({
+    title: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.title', 'Plus plan required'),
+    body: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.body', 'Legal and Academic domain mode is available on the Plus plan.'),
+    cta: requiredPlanCta(d, tOr, 'domain_mode'),
+    severity: 'warning',
+  }),
 
   // ─── Collections ───
   COLLECTION_LIMIT_REACHED: (d, tOr) => ({
diff --git a/frontend/src/lib/useChatStream.ts b/frontend/src/lib/useChatStream.ts
index 3c616c8..0397e9c 100644
--- a/frontend/src/lib/useChatStream.ts
+++ b/frontend/src/lib/useChatStream.ts
@@ -187,6 +187,7 @@ export function useChatStream({
       || code === 'MODE_NOT_ALLOWED'
       || code === 'PRO_MODE_LIMIT_REACHED'
       || code === 'BALANCED_MODE_LIMIT_REACHED'
+      || code === 'DOMAIN_MODE_REQUIRES_PLUS'
     ) {
       const reason = code || 'paid_limit';
       // I27: previously hardcoded `plan: 'plus'`, which falsely attributed
     1	import type { ApiError } from './api';
     2	import { billingHref, type BillingPlanIntent } from './billingLinks';
     3	
     4	export interface ErrorCopy {
     5	  /** Short, one-line summary — suitable for toast title / inline heading. */
     6	  title: string;
     7	  /** Optional longer body with remediation detail + interpolated context. */
     8	  body: string;
     9	  /** Optional CTA button (e.g., upgrade or delete-docs link). */
    10	  cta?: { label: string; href: string };
    11	  severity: 'error' | 'warning' | 'info';
    12	  /**
    13	   * Whether the consumer should auto-open the paywall modal.
    14	   * Only true for 402 credit/mode paywalls and SSE MODE_NOT_ALLOWED
    15	   * (Codex r1 Q2: all other plan-limit 403s use inline CTA, never auto-modal).
    16	   */
    17	  openPaywall?: boolean;
    18	}
    19	
    20	type TFn = (key: string, params?: Record<string, string | number>) => string;
    21	type TOrFn = (key: string, fallback: string, params?: Record<string, string | number>) => string;
    22	
    23	/**
    24	 * Minimal shape the mapper needs. Callers pass either an `ApiError`
    25	 * (from api.ts), an SSE `{ code, message, status? }` frame (from sse.ts
    26	 * error event), or any thrown value (falls through to generic copy).
    27	 */
    28	interface ErrLike {
    29	  code?: unknown;
    30	  status?: unknown;
    31	  detail?: unknown;
    32	  message?: unknown;
    33	}
    34	
    35	type ErrorInput = ApiError | ErrLike | unknown;
    36	
    37	function extract(err: ErrorInput): { code: string | null; status: number | null; detail: Record<string, unknown> } {
    38	  if (err && typeof err === 'object') {
    39	    const e = err as ErrLike;
    40	    const rawDetail = e.detail;
    41	    const detail = (rawDetail && typeof rawDetail === 'object')
    42	      ? (rawDetail as Record<string, unknown>)
    43	      : {};
    44	    return {
    45	      code: typeof e.code === 'string' ? e.code : null,
    46	      status: typeof e.status === 'number' ? e.status : null,
    47	      detail,
    48	    };
    49	  }
    50	  return { code: null, status: null, detail: {} };
    51	}
    52	
    53	export function errorCopy(err: ErrorInput, t: TFn, tOr: TOrFn): ErrorCopy {
    54	  // Kept for signature symmetry with existing i18n call-sites.
    55	  void t;
    56	
    57	  const { code, status, detail } = extract(err);
    58	
    59	  // Dispatch by canonical code first; fall through by status; finally generic network.
    60	  if (code) {
    61	    const handler = CODE_TABLE[code];
    62	    if (handler) return handler(detail, tOr);
    63	  }
    64	
    65	  if (status != null) {
    66	    const statusHandler = STATUS_TABLE[status];
    67	    if (statusHandler) return statusHandler(detail, tOr);
    68	  }
    69	
    70	  return {
    71	    title: tOr('errors.NETWORK.title', 'Connection issue'),
    72	    body: tOr('errors.NETWORK.body', 'Something went wrong. Please check your connection and try again.'),
    73	    severity: 'error',
    74	  };
    75	}
    76	
    77	// ────────────────────────────────────────────────────────────────────
    78	// Code handlers — one per wire code. Keep these pure + declarative.
    79	// ────────────────────────────────────────────────────────────────────
    80	
    81	type Handler = (detail: Record<string, unknown>, tOr: TOrFn) => ErrorCopy;
    82	
    83	function targetPlan(detail: Record<string, unknown>, fallback: BillingPlanIntent = 'plus'): BillingPlanIntent {
    84	  return detail.plan === 'plus' ? 'pro' : fallback;
    85	}
    86	
    87	function upgradeCta(tOr: TOrFn, reason: string, plan: BillingPlanIntent = 'plus') {
    88	  return {
    89	    label: tOr('errors.cta.upgrade', 'Upgrade'),
    90	    href: billingHref({ plan, source: 'limit', reason }),
    91	  };
    92	}
    93	
    94	function requiredPlanCta(detail: Record<string, unknown>, tOr: TOrFn, reason: string) {
    95	  const requiredPlan = detail.required_plan;
    96	  if (requiredPlan === 'plus' || requiredPlan === 'pro') {
    97	    return upgradeCta(tOr, reason, requiredPlan);
    98	  }
    99	  return undefined;
   100	}
   101	
   102	const CODE_TABLE: Record<string, Handler> = {
   103	  // ─── Upload ───
   104	  DOCUMENT_LIMIT_REACHED: (d, tOr) => ({
   105	    title: tOr('errors.DOCUMENT_LIMIT_REACHED.title', 'Document limit reached'),
   106	    body: tOr('errors.DOCUMENT_LIMIT_REACHED.body', 'You\'ve reached your plan\'s document limit ({limit}). Delete an old document or upgrade for more.', {
   107	      limit: String(d.limit ?? ''),
   108	    }),
   109	    cta: upgradeCta(tOr, 'document_limit', targetPlan(d)),
   110	    severity: 'warning',
   111	  }),
   112	  FILE_TOO_LARGE: (d, tOr) => ({
   113	    title: tOr('errors.FILE_TOO_LARGE.title', 'File too large'),
   114	    body: tOr('errors.FILE_TOO_LARGE.body', 'Maximum file size on your plan is {maxMb} MB. Upgrade for larger uploads.', {
   115	      maxMb: String(d.max_mb ?? ''),
   116	    }),
   117	    cta: upgradeCta(tOr, 'file_size', targetPlan(d)),
   118	    severity: 'warning',
   119	  }),
   120	  UNSUPPORTED_FORMAT: (_d, tOr) => ({
   121	    title: tOr('errors.UNSUPPORTED_FORMAT.title', 'Unsupported file format'),
   122	    body: tOr('errors.UNSUPPORTED_FORMAT.body', 'Please upload a PDF, DOCX, PPTX, XLSX, TXT, or MD file.'),
   123	    severity: 'error',
   124	  }),
   125	  INVALID_FILE_CONTENT: (_d, tOr) => ({
   126	    title: tOr('errors.INVALID_FILE_CONTENT.title', 'File content invalid'),
   127	    body: tOr('errors.INVALID_FILE_CONTENT.body', 'The file doesn\'t match its declared format, or appears corrupted.'),
   128	    severity: 'error',
   129	  }),
   130	
   131	  // ─── URL ingest ───
   132	  URL_INVALID: (_d, tOr) => ({
   133	    title: tOr('errors.URL_INVALID.title', 'Invalid URL'),
   134	    body: tOr('errors.URL_INVALID.body', 'Enter a full URL starting with http:// or https://.'),
   135	    severity: 'error',
   136	  }),
   137	  URL_FETCH_BLOCKED: (_d, tOr) => ({
   138	    title: tOr('errors.URL_FETCH_BLOCKED.title', 'URL can\'t be imported'),
   139	    body: tOr('errors.URL_FETCH_BLOCKED.body', 'This URL can\'t be fetched. Try a public web page.'),
   140	    severity: 'error',
   141	  }),
   142	  URL_CONTENT_TOO_LARGE: (_d, tOr) => ({
   143	    title: tOr('errors.URL_CONTENT_TOO_LARGE.title', 'Page too large'),
   144	    body: tOr('errors.URL_CONTENT_TOO_LARGE.body', 'The page is too large to import.'),
   145	    severity: 'error',
   146	  }),
   147	  NO_TEXT_CONTENT: (_d, tOr) => ({
   148	    title: tOr('errors.NO_TEXT_CONTENT.title', 'No text on page'),
   149	    body: tOr('errors.NO_TEXT_CONTENT.body', 'No readable text was found on this page.'),
   150	    severity: 'error',
   151	  }),
   152	  URL_FETCH_FAILED: (_d, tOr) => ({
   153	    title: tOr('errors.URL_FETCH_FAILED.title', 'URL fetch failed'),
   154	    body: tOr('errors.URL_FETCH_FAILED.body', 'Couldn\'t fetch the URL. Try again later.'),
   155	    severity: 'error',
   156	  }),
   157	
   158	  // ─── Document state ───
   159	  DOCUMENT_NOT_FOUND: (_d, tOr) => ({
   160	    title: tOr('errors.DOCUMENT_NOT_FOUND.title', 'Document not found'),
   161	    body: tOr('errors.DOCUMENT_NOT_FOUND.body', 'This document doesn\'t exist or isn\'t yours.'),
   162	    severity: 'error',
   163	  }),
   164	  DOCUMENT_PROCESSING: (_d, tOr) => ({
   165	    title: tOr('errors.DOCUMENT_PROCESSING.title', 'Still processing'),
   166	    body: tOr('errors.DOCUMENT_PROCESSING.body', 'The document is still being processed. Try again in a moment.'),
   167	    severity: 'info',
   168	  }),
   169	  STORAGE_UNAVAILABLE: (_d, tOr) => ({
   170	    title: tOr('errors.STORAGE_UNAVAILABLE.title', 'Storage unavailable'),
   171	    body: tOr('errors.STORAGE_UNAVAILABLE.body', 'Document storage is temporarily unavailable. Please try again shortly.'),
   172	    severity: 'error',
   173	  }),
   174	  INSTRUCTIONS_TOO_LONG: (d, tOr) => ({
   175	    title: tOr('errors.INSTRUCTIONS_TOO_LONG.title', 'Instructions too long'),
   176	    body: tOr('errors.INSTRUCTIONS_TOO_LONG.body', 'Custom instructions are limited to {max} characters.', {
   177	      max: String(d.max ?? 2000),
   178	    }),
   179	    severity: 'warning',
   180	  }),
   181	  CUSTOM_INSTRUCTIONS_REQUIRE_PRO: (_d, tOr) => ({
   182	    title: tOr('errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.title', 'Pro plan required'),
   183	    body: tOr('errors.CUSTOM_INSTRUCTIONS_REQUIRE_PRO.body', 'Custom instructions are available on the Pro plan.'),
   184	    cta: upgradeCta(tOr, 'custom_instructions', 'pro'),
   185	    severity: 'warning',
   186	  }),
   187	
   188	  // ─── Sessions / chat ───
   189	  SESSION_LIMIT_REACHED: (d, tOr) => ({
   190	    title: tOr('errors.SESSION_LIMIT_REACHED.title', 'Session limit reached'),
   191	    body: tOr('errors.SESSION_LIMIT_REACHED.body', 'Free plan is limited to {limit} chat sessions per document. Upgrade for unlimited.', {
   192	      limit: String(d.limit ?? ''),
   193	    }),
   194	    cta: upgradeCta(tOr, 'session_limit', 'plus'),
   195	    severity: 'warning',
   196	  }),
   197	  SESSION_NOT_FOUND: (_d, tOr) => ({
   198	    title: tOr('errors.SESSION_NOT_FOUND.title', 'Session not found'),
   199	    body: tOr('errors.SESSION_NOT_FOUND.body', 'This chat session doesn\'t exist or isn\'t yours.'),
   200	    severity: 'error',
   201	  }),
   202	  MESSAGE_NOT_FOUND: (_d, tOr) => ({
   203	    title: tOr('errors.MESSAGE_NOT_FOUND.title', 'Message not found'),
   204	    body: tOr('errors.MESSAGE_NOT_FOUND.body', 'The referenced message no longer exists.'),
   205	    severity: 'error',
   206	  }),
   207	  RATE_LIMITED: (d, tOr) => ({
   208	    title: tOr('errors.RATE_LIMITED.title', 'Too many requests'),
   209	    body: tOr('errors.RATE_LIMITED.body', 'Please slow down and try again in {retryAfter}s.', {
   210	      retryAfter: String(d.retry_after ?? 60),
   211	    }),
   212	    severity: 'warning',
   213	  }),
   214	  DEMO_SESSION_RATE_LIMITED: (d, tOr) => ({
   215	    title: tOr('errors.DEMO_SESSION_RATE_LIMITED.title', 'Too many demo sessions'),
   216	    body: tOr('errors.DEMO_SESSION_RATE_LIMITED.body', 'Please wait {retryAfter}s before creating another demo session.', {
   217	      retryAfter: String(d.retry_after ?? 300),
   218	    }),
   219	    severity: 'warning',
   220	  }),
   221	  DEMO_SESSION_LIMIT_REACHED: (_d, tOr) => ({
   222	    title: tOr('errors.DEMO_SESSION_LIMIT_REACHED.title', 'Demo limit reached'),
   223	    body: tOr('errors.DEMO_SESSION_LIMIT_REACHED.body', 'This demo document has reached its session capacity. Try again later.'),
   224	    severity: 'warning',
   225	  }),
   226	  DEMO_MESSAGE_LIMIT_REACHED: (_d, tOr) => ({
   227	    title: tOr('errors.DEMO_MESSAGE_LIMIT_REACHED.title', 'Demo limit reached'),
   228	    body: tOr('errors.DEMO_MESSAGE_LIMIT_REACHED.body', 'You\'ve used all demo messages. Sign in to upload your own documents.'),
   229	    cta: { label: tOr('errors.cta.signin', 'Sign in'), href: '/auth' },
   230	    severity: 'info',
   231	  }),
   232	  INSUFFICIENT_CREDITS: (d, tOr) => ({
   233	    title: tOr('errors.INSUFFICIENT_CREDITS.title', 'Out of credits'),
   234	    body: tOr('errors.INSUFFICIENT_CREDITS.body', 'You need {required} credits but only have {balance}. Top up or upgrade.', {
   235	      required: String(d.required ?? ''),
   236	      balance: String(d.balance ?? ''),
   237	    }),
   238	    cta: upgradeCta(tOr, 'credits', 'plus'),
   239	    severity: 'warning',
   240	    openPaywall: true,
   241	  }),
   242	  BALANCED_MODE_LIMIT_REACHED: (d, tOr) => ({
   243	    title: tOr('errors.BALANCED_MODE_LIMIT_REACHED.title', 'Pro limit reached'),
   244	    body: tOr(
   245	      'errors.BALANCED_MODE_LIMIT_REACHED.body',
   246	      'Free includes up to {limit} Pro answers per month. Upgrade to Plus for unrestricted Pro mode.',
   247	      { limit: String(d.limit ?? 20) },
   248	    ),
   249	    cta: upgradeCta(tOr, 'pro_mode_limit', 'plus'),
   250	    severity: 'warning',
   251	    openPaywall: true,
   252	  }),
   253	  PRO_MODE_LIMIT_REACHED: (d, tOr) => ({
   254	    title: tOr('errors.PRO_MODE_LIMIT_REACHED.title', 'Pro limit reached'),
   255	    body: tOr(
   256	      'errors.PRO_MODE_LIMIT_REACHED.body',
   257	      'Free includes up to {limit} Pro answers per month. Upgrade to Plus for unrestricted Pro mode.',
   258	      { limit: String(d.limit ?? 20) },
   259	    ),
   260	    cta: upgradeCta(tOr, 'pro_mode_limit', 'plus'),
   261	    severity: 'warning',
   262	    openPaywall: true,
   263	  }),
   264	  CONTINUATION_LIMIT: (d, tOr) => ({
   265	    title: tOr('errors.CONTINUATION_LIMIT.title', 'Continue limit reached'),
   266	    body: tOr('errors.CONTINUATION_LIMIT.body', 'You can only continue a response {max} times.', {
   267	      max: String(d.max ?? 3),
   268	    }),
   269	    severity: 'info',
   270	  }),
   271	  MODE_NOT_ALLOWED: (_d, tOr) => ({
   272	    title: tOr('errors.MODE_NOT_ALLOWED.title', 'Plus plan required'),
   273	    body: tOr('errors.MODE_NOT_ALLOWED.body', 'This mode is available on the Plus plan.'),
   274	    cta: upgradeCta(tOr, 'mode_upgrade', 'plus'),
   275	    severity: 'warning',
   276	    openPaywall: true,
   277	  }),
   278	  DOMAIN_MODE_REQUIRES_PLUS: (d, tOr) => ({
   279	    title: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.title', 'Plus plan required'),
   280	    body: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.body', 'Legal and Academic domain mode is available on the Plus plan.'),
   281	    cta: requiredPlanCta(d, tOr, 'domain_mode'),
   282	    severity: 'warning',
   283	  }),
   284	
   285	  // ─── Collections ───
   286	  COLLECTION_LIMIT_REACHED: (d, tOr) => ({
   287	    title: tOr('errors.COLLECTION_LIMIT_REACHED.title', 'Collection limit reached'),
   288	    body: tOr('errors.COLLECTION_LIMIT_REACHED.body', 'Your plan allows up to {limit} collections. Upgrade for more.', {
   289	      limit: String(d.limit ?? ''),
   290	    }),
   291	    cta: upgradeCta(tOr, 'collection_limit', targetPlan(d)),
   292	    severity: 'warning',
   293	  }),
   294	  COLLECTION_DOC_LIMIT_REACHED: (d, tOr) => ({
   295	    title: tOr('errors.COLLECTION_DOC_LIMIT_REACHED.title', 'Too many documents'),
   296	    body: tOr('errors.COLLECTION_DOC_LIMIT_REACHED.body', 'Your plan allows up to {limit} documents per collection. Upgrade for more.', {
   297	      limit: String(d.limit ?? ''),
   298	    }),
   299	    cta: upgradeCta(tOr, 'collection_doc_limit', targetPlan(d)),
   300	    severity: 'warning',
   301	  }),
   302	  COLLECTION_NOT_FOUND: (_d, tOr) => ({
   303	    title: tOr('errors.COLLECTION_NOT_FOUND.title', 'Collection not found'),
   304	    body: tOr('errors.COLLECTION_NOT_FOUND.body', 'This collection doesn\'t exist or isn\'t yours.'),
   305	    severity: 'error',
   306	  }),
   307	
   308	  // ─── Export ───
   309	  EXPORT_REQUIRES_PAID_PLAN: (d, tOr) => ({
   310	    title: tOr('errors.EXPORT_REQUIRES_PAID_PLAN.title', 'Paid plan required'),
   311	    body: tOr('errors.EXPORT_REQUIRES_PAID_PLAN.body', '{format} export requires a Plus or Pro plan.', {
   312	      format: String(d.format ?? 'PDF/DOCX').toUpperCase(),
   313	    }),
   314	    cta: upgradeCta(tOr, 'export', 'plus'),
   315	    severity: 'warning',
   316	  }),
   317	  EXPORT_VALIDATION_FAILED: (_d, tOr) => ({
   318	    title: tOr('errors.EXPORT_VALIDATION_FAILED.title', 'Export failed'),
   319	    body: tOr('errors.EXPORT_VALIDATION_FAILED.body', 'Couldn\'t build the export — this session may have too many messages.'),
   320	    severity: 'error',
   321	  }),
   322	  EXPORT_RENDERER_FAILED: (_d, tOr) => ({
   323	    title: tOr('errors.EXPORT_RENDERER_FAILED.title', 'Export failed'),
   324	    body: tOr('errors.EXPORT_RENDERER_FAILED.body', 'The export couldn\'t be generated. Please try again.'),
   325	    severity: 'error',
   326	  }),
   327	  LAYOUT_TRANSLATION_LIMIT_REACHED: (d, tOr) => ({
   328	    title: tOr('errors.LAYOUT_TRANSLATION_LIMIT_REACHED.title', 'PDF translation limit reached'),
   329	    body: tOr(
   330	      'errors.LAYOUT_TRANSLATION_LIMIT_REACHED.body',
   331	      'Free includes {limit} layout-preserving PDF translations. Upgrade to Plus to keep using it.',
   332	      { limit: String(d.limit ?? 2) },
   333	    ),
   334	    cta: upgradeCta(tOr, 'layout_translation_limit', 'plus'),
   335	    severity: 'warning',
   336	  }),
   337	  LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED: (d, tOr) => ({
   338	    title: tOr('errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.title', 'PDF too long for layout translation'),
   339	    body: tOr(
   340	      'errors.LAYOUT_TRANSLATION_PAGE_LIMIT_EXCEEDED.body',
     1	export type BillingPlanIntent = 'plus' | 'pro';
     2	export type BillingPeriodIntent = 'monthly' | 'annual';
     3	
     4	interface BillingHrefOptions {
     5	  plan?: BillingPlanIntent;
     6	  period?: BillingPeriodIntent;
     7	  source?: string;
     8	  reason?: string;
     9	}
    10	
    11	export function billingHref({
    12	  plan = 'plus',
    13	  period = 'monthly',
    14	  source,
    15	  reason,
    16	}: BillingHrefOptions = {}): string {
    17	  const params = new URLSearchParams({ plan, period });
    18	  if (source) params.set('source', source);
    19	  if (reason) params.set('reason', reason);
    20	  return `/billing?${params.toString()}`;
    21	}
    22	
    23	export function authHrefFor(path: string): string {
    24	  return `/auth?callbackUrl=${encodeURIComponent(path)}`;
    25	}
    26	
    27	/**
    28	 * Derive the upgrade-target plan to report to the user (and in analytics),
    29	 * given the user's current billing tier and the paywall reason code. Mirrors
    30	 * the disambiguation implicit in PaywallModal's copy:
    31	 *   - Pro-cap reasons (PRO_MODE_LIMIT_REACHED / BALANCED_MODE_LIMIT_REACHED /
    32	 *     MODE_NOT_ALLOWED): Free user upgrades to Plus (Plus = unrestricted Pro),
    33	 *     Plus user upgrades to Pro.
    34	 *   - INSUFFICIENT_CREDITS / generic 402: Free → Plus, Plus → Pro,
    35	 *     Pro → 'pro' (already on top plan; the funnel still rolls up under the
    36	 *     existing plan rather than getting falsely attributed to a Plus upgrade).
    37	 *   - LAYOUT_TRANSLATION_LIMIT_REACHED / DOMAIN_MODE_REQUIRES_PLUS: always
    38	 *     'plus' — both gates are plan checks that already pass for Plus/Pro, so
    39	 *     they only ever fire for a free-plan user.
    40	 *
    41	 * Shared by `useChatStream.ts` (analytics + paywall trigger) and
    42	 * `PaywallModal.tsx` (CTA href + click analytics) so the route the user is
    43	 * sent to matches the funnel event they generated. Keep them in sync.
    44	 */
    45	export function deriveUpgradePlan(
    46	  currentPlan: string | undefined,
    47	  reason: string | null | undefined,
    48	): BillingPlanIntent {
    49	  if (reason === 'LAYOUT_TRANSLATION_LIMIT_REACHED' || reason === 'DOMAIN_MODE_REQUIRES_PLUS') {
    50	    return 'plus';
    51	  }
    52	  const isProCap = reason === 'PRO_MODE_LIMIT_REACHED'
    53	    || reason === 'BALANCED_MODE_LIMIT_REACHED'
    54	    || reason === 'MODE_NOT_ALLOWED';
    55	  if (isProCap) {
    56	    return currentPlan === 'plus' ? 'pro' : 'plus';
    57	  }
    58	  // Credit-exhaustion path.
    59	  if (currentPlan === 'plus' || currentPlan === 'pro') {
    60	    return 'pro';
    61	  }
    62	  return 'plus';
    63	}
     1	"use client";
     2	
     3	import { useEffect, useRef } from "react";
     4	import Link from "next/link";
     5	import { CheckCircle2 } from "lucide-react";
     6	import { useLocale } from "../i18n";
     7	import { billingHref, deriveUpgradePlan } from "../lib/billingLinks";
     8	import { trackEvent } from "../lib/analytics";
     9	
    10	interface PaywallModalProps {
    11	  isOpen: boolean;
    12	  onClose: () => void;
    13	  reason?: string | null;
    14	  /**
    15	   * Current user's billing tier ('free' | 'plus' | 'pro' | undefined for
    16	   * anonymous/demo). Determines whether the CTA targets the Plus or Pro
    17	   * upgrade page when the paywall fires. A Plus user hitting the Pro-mode cap
    18	   * needs to be routed to Pro — not bounced back to the Plus they already
    19	   * have (I18). Mirrors the analytics-side derivation in useChatStream (I27).
    20	   */
    21	  currentPlan?: string;
    22	}
    23	
    24	function paywallCopy(reason: string | null | undefined, t: (key: string) => string, tOr: (key: string, fallback: string) => string) {
    25	  if (reason === 'PRO_MODE_LIMIT_REACHED' || reason === 'BALANCED_MODE_LIMIT_REACHED' || reason === 'MODE_NOT_ALLOWED') {
    26	    return {
    27	      title: tOr('paywall.proMode.title', 'Keep using Pro analysis'),
    28	      body: tOr('paywall.proMode.body', 'Free includes a limited number of Pro answers. Plus unlocks unrestricted Pro mode for deeper cited analysis.'),
    29	      primaryLabel: tOr('paywall.proMode.cta', 'Upgrade for Pro mode'),
    30	      reason: 'pro_mode_limit',
    31	    };
    32	  }
    33	
    34	  if (reason === 'DOMAIN_MODE_REQUIRES_PLUS') {
    35	    return {
    36	      title: tOr('paywall.domainMode.title', 'Unlock Legal & Academic mode'),
    37	      body: tOr('paywall.domainMode.body', 'Legal and Academic domain mode is available on the Plus plan, tuning citations and prompts for domain-specific reading.'),
    38	      primaryLabel: tOr('paywall.domainMode.cta', 'Upgrade for domain mode'),
    39	      reason: 'domain_mode',
    40	    };
    41	  }
    42	
    43	  if (reason === 'LAYOUT_TRANSLATION_LIMIT_REACHED') {
    44	    return {
    45	      title: tOr('paywall.layoutTranslation.title', 'Keep translating full PDFs'),
    46	      body: tOr('paywall.layoutTranslation.body', 'Free includes 2 layout-preserving PDF translations. Plus unlocks this workflow for active document work.'),
    47	      primaryLabel: tOr('paywall.layoutTranslation.cta', 'Upgrade for PDF translation'),
    48	      reason: 'layout_translation_limit',
    49	    };
    50	  }
    51	
    52	  if (reason === 'SAVED_QUOTES_LIMIT_REACHED') {
    53	    return {
    54	      title: tOr('paywall.savedQuotes.title', 'Keep saving quotes'),
    55	      body: tOr('paywall.savedQuotes.body', 'Free includes 30 saved quotes. Plus unlocks up to 999 for building out a full research library.'),
    56	      primaryLabel: tOr('paywall.savedQuotes.cta', 'Upgrade to save more quotes'),
    57	      reason: 'saved_quotes_limit',
    58	    };
    59	  }
    60	
    61	  return {
    62	    title: t("credits.insufficientCredits"),
    63	    body: t("credits.purchasePrompt"),
    64	    primaryLabel: t("credits.upgradeToPlus"),
    65	    reason: 'credits',
    66	  };
    67	}
    68	
    69	export function PaywallModal({ isOpen, onClose, reason, currentPlan }: PaywallModalProps) {
    70	  const { t, tOr } = useLocale();
    71	  const modalRef = useRef<HTMLDivElement>(null);
    72	  const copy = paywallCopy(reason, t, tOr);
    73	  const targetPlan = deriveUpgradePlan(currentPlan, reason ?? null);
    74	
    75	  useEffect(() => {
    76	    if (!isOpen) return;
    77	    const previouslyFocused = document.activeElement as HTMLElement;
    78	    const modal = modalRef.current;
    79	    if (!modal) return;
    80	
    81	    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    82	    const focusables = modal.querySelectorAll<HTMLElement>(focusableSelector);
    83	    focusables[0]?.focus();
    84	
    85	    function handleKeyDown(e: KeyboardEvent) {
    86	      if (e.key === 'Escape') {
    87	        onClose();
    88	        return;
    89	      }
    90	      if (e.key !== 'Tab') return;
    91	      const currentFocusables = modal!.querySelectorAll<HTMLElement>(focusableSelector);
    92	      const first = currentFocusables[0];
    93	      const last = currentFocusables[currentFocusables.length - 1];
    94	      if (e.shiftKey) {
    95	        if (document.activeElement === first) {
    96	          e.preventDefault();
    97	          last?.focus();
    98	        }
    99	      } else {
   100	        if (document.activeElement === last) {
   101	          e.preventDefault();
   102	          first?.focus();
   103	        }
   104	      }
   105	    }
   106	
   107	    modal.addEventListener('keydown', handleKeyDown);
   108	    return () => {
   109	      modal.removeEventListener('keydown', handleKeyDown);
   110	      previouslyFocused?.focus();
   111	    };
   112	  }, [isOpen, onClose]);
   113	
   114	  if (!isOpen) return null;
   115	
   116	  return (
   117	    <div
   118	      ref={modalRef}
   119	      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in motion-reduce:animate-none overscroll-contain"
   120	      onClick={onClose}
   121	      tabIndex={-1}
   122	    >
   123	      <div
   124	        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl animate-slide-up motion-reduce:animate-none"
   125	        role="dialog"
   126	        aria-modal="true"
   127	        aria-labelledby="paywall-title"
   128	        onClick={(e) => e.stopPropagation()}
   129	      >
   130	        <h2 id="paywall-title" className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
   131	          {copy.title}
   132	        </h2>
   133	        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
   134	          {copy.body}
   135	        </p>
   136	        <ul className="mb-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
   137	          {[
   138	            tOr('paywall.benefit.credits', 'More monthly credits for active document work'),
   139	            tOr('paywall.benefit.modes', 'Flash and Pro modes without the free-plan cap'),
   140	            tOr('paywall.benefit.layoutTranslation', 'Layout-preserving PDF translation for complex papers and reports'),
   141	            tOr('paywall.benefit.exports', 'PDF and DOCX exports for cited deliverables'),
   142	          ].map((benefit) => (
   143	            <li key={benefit} className="flex gap-2">
   144	              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
   145	              <span>{benefit}</span>
   146	            </li>
   147	          ))}
   148	        </ul>
   149	        <div className="flex flex-col gap-3 sm:flex-row">
   150	          <Link
   151	            href={billingHref({ plan: targetPlan, source: 'paywall_modal', reason: copy.reason })}
   152	            onClick={() => trackEvent('upgrade_click', { plan: targetPlan, period: 'monthly', source: 'paywall_modal', reason: copy.reason })}
   153	            className="flex-1 px-4 py-2 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm hover:shadow-md transition-colors text-center focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
   154	          >
   155	            {copy.primaryLabel}
   156	          </Link>
   157	          <button
   158	            onClick={onClose}
   159	            className="px-4 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
   160	          >
   161	            {t("common.cancel")}
   162	          </button>
   163	        </div>
   164	      </div>
   165	    </div>
   166	  );
   167	}

codex
A notable contract mismatch is emerging: `openPaywall` was removed to preserve the “403s are inline CTA” taxonomy, but chat still hard-codes `DOMAIN_MODE_REQUIRES_PLUS` into the auto-modal trigger. I’m checking whether that is merely redundant UX or a real invariant violation, and whether all resulting links are guaranteed internal billing URLs.
exec
/bin/zsh -lc "nl -ba frontend/src/lib/useChatStream.ts | sed -n '150,270p'
nl -ba frontend/src/components/Chat/ChatPanel.tsx | sed -n '360,470p;620,780p'
nl -ba frontend/src/components/Chat/MessageBubble.tsx | sed -n '1,280p'
rg -n --glob '*.{ts,tsx}' 'ReactMarkdown|components=|linkTarget|allowedElements|rehype|remark|href' frontend/src/components/Chat frontend/src/components | head -n 240
rg -n --glob '*.{ts,tsx}' 'openPaywall' frontend/src
rg -n --glob '*.{ts,tsx}' 'errorCopy\\(' frontend/src | sort" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   150	        // Same-session guard alone isn't enough (Codex r4): a failed
   151	        // regenerate can issue this GET, and the user can send a NEW
   152	        // message on the SAME session before it resolves — the sessionId
   153	        // check can't see that, since sendMessage never changes sessionId.
   154	        // demoAccountingEpoch is bumped by every operation that mutates
   155	        // these two fields (adopt/create, sendMessage start, regen/continue
   156	        // bump); if it moved since this reanchor was issued, some other
   157	        // accounting event happened in between and its own state is
   158	        // authoritative — writing this stale snapshot over it would erase
   159	        // that newer event's delta. Drop it silently either way; a later
   160	        // failure (if any) issues its own fresh reanchor against current
   161	        // state.
   162	        if (state.demoAccountingEpoch !== epochAtCall) return;
   163	        state.setDemoMessagesUsed(msgsData.demo_messages_used);
   164	        state.setDemoRestoredUserMsgCount(
   165	          state.messages.filter((m) => m.role === 'user').length,
   166	        );
   167	      })
   168	      .catch(() => {
   169	        // best-effort — a later restore/regenerate/continue will try again
   170	      });
   171	  }, [maxUserMessages]);
   172	
   173	  const handleStreamError = useCallback((err: unknown) => {
   174	    flushPendingText();
   175	    setStreaming(false);
   176	    abortRef.current = null;
   177	
   178	    const { message, code, status } = getErrorMeta(err);
   179	
   180	    if (isAbortLikeError(err)) {
   181	      return;
   182	    }
   183	
   184	    if (
   185	      status === 402
   186	      || code === 'INSUFFICIENT_CREDITS'
   187	      || code === 'MODE_NOT_ALLOWED'
   188	      || code === 'PRO_MODE_LIMIT_REACHED'
   189	      || code === 'BALANCED_MODE_LIMIT_REACHED'
   190	      || code === 'DOMAIN_MODE_REQUIRES_PLUS'
   191	    ) {
   192	      const reason = code || 'paid_limit';
   193	      // I27: previously hardcoded `plan: 'plus'`, which falsely attributed
   194	      // every paywall event in the funnel to plus-upgrade intent regardless
   195	      // of what triggered it (e.g. a Plus user hitting the Pro cap was logged
   196	      // as a Plus-upgrade event). Derive the actual upgrade target from
   197	      // (currentPlan, reason) so the upgrade-funnel analytics aren't poisoned.
   198	      const upgradePlan = deriveUpgradePlan(currentPlan, reason);
   199	      trackEvent('limit_hit', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
   200	      trackEvent('paywall_opened', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
   201	      onShowPaywall(reason);
   202	      return;
   203	    }
   204	
   205	    if (status === 409 || code === 'DOCUMENT_PROCESSING') {
   206	      addMessage({
   207	        id: `m_${Date.now()}_proc`,
   208	        role: 'assistant',
   209	        text: t('doc.processing'),
   210	        createdAt: Date.now(),
   211	      });
   212	      return;
   213	    }
   214	
   215	    if (
   216	      status === 429
   217	      || code === 'RATE_LIMITED'
   218	      || code === 'DEMO_SESSION_RATE_LIMITED'
   219	      || code === 'DEMO_MESSAGE_LIMIT_REACHED'
   220	      || code === 'DEMO_SESSION_LIMIT_REACHED'
   221	    ) {
   222	      trackEvent('limit_hit', { source: 'chat_stream', reason: code || 'rate_or_demo_limit' });
   223	      const isRateLimited = code === 'RATE_LIMITED'
   224	        || code === 'DEMO_SESSION_RATE_LIMITED'
   225	        || message.includes('Rate limit exceeded');
   226	      addMessage({
   227	        id: `m_${Date.now()}_limit`,
   228	        role: 'assistant',
   229	        text: isRateLimited ? t('demo.rateLimitMessage') : t('demo.limitReachedMessage'),
   230	        createdAt: Date.now(),
   231	      });
   232	      return;
   233	    }
   234	
   235	    const copy = errorCopy(err, t, tOr);
   236	    const state = useDocTalkStore.getState();
   237	    const currentMessages = state.messages;
   238	    const lastMessage = currentMessages[currentMessages.length - 1];
   239	    const lastAssistantIsEmpty = lastMessage?.role === 'assistant'
   240	      && !lastMessage.text
   241	      && !lastMessage.toolStatus
   242	      && (!lastMessage.citations || lastMessage.citations.length === 0)
   243	      && (!lastMessage.artifacts || lastMessage.artifacts.length === 0);
   244	
   245	    if (lastAssistantIsEmpty) {
   246	      state.setMessages([
   247	        ...currentMessages.slice(0, -1),
   248	        {
   249	          ...lastMessage,
   250	          text: copy.body,
   251	          isError: true,
   252	          isTruncated: false,
   253	        },
   254	      ]);
   255	      return;
   256	    }
   257	
   258	    addMessage({
   259	      id: `m_${Date.now()}_e`,
   260	      role: 'assistant',
   261	      text: copy.body,
   262	      isError: true,
   263	      createdAt: Date.now(),
   264	    });
   265	  }, [addMessage, flushPendingText, getErrorMeta, isAbortLikeError, onShowPaywall, setStreaming, t, tOr, currentPlan]);
   266	
   267	  const handleTruncated = useCallback(() => {
   268	    flushPendingText();
   269	    markLastMessageTruncated(true);
   270	  }, [flushPendingText, markLastMessageTruncated]);
   360	      const copy = errorCopy(e, t, tOr);
   361	      addMessage({
   362	        id: `m_${Date.now()}_exp`,
   363	        role: 'assistant',
   364	        text: copy.body,
   365	        isError: true,
   366	        createdAt: Date.now(),
   367	      });
   368	    }
   369	  }, [addMessage, sessionId, t, tOr]);
   370	
   371	  const [shareLoading, setShareLoading] = useState(false);
   372	  const [shareAnswerLoadingId, setShareAnswerLoadingId] = useState<string | null>(null);
   373	
   374	  const copyShareUrl = useCallback(async (url: string) => {
   375	    try {
   376	      await navigator.clipboard.writeText(url);
   377	      return;
   378	    } catch {
   379	      const textarea = document.createElement('textarea');
   380	      textarea.value = url;
   381	      textarea.setAttribute('readonly', '');
   382	      textarea.style.position = 'fixed';
   383	      textarea.style.opacity = '0';
   384	      document.body.appendChild(textarea);
   385	      textarea.select();
   386	      document.execCommand('copy');
   387	      document.body.removeChild(textarea);
   388	    }
   389	  }, []);
   390	
   391	  const handleShare = useCallback(async () => {
   392	    if (shareLoading) return;
   393	    setShareLoading(true);
   394	    try {
   395	      const { createShare } = await import('../../lib/api');
   396	      const result = await createShare(sessionId);
   397	      await copyShareUrl(result.url);
   398	      trackEvent('share_created', { source: 'chat_panel', plan: userPlan || 'unknown' });
   399	      addMessage({
   400	        id: `m_${Date.now()}_share_ok`,
   401	        role: 'assistant',
   402	        text: tOr('share.copied', 'Link copied to clipboard.'),
   403	        createdAt: Date.now(),
   404	      });
   405	    } catch (e) {
   406	      console.error('Share failed:', e);
   407	      const copy = errorCopy(e, t, tOr);
   408	      addMessage({
   409	        id: `m_${Date.now()}_share_err`,
   410	        role: 'assistant',
   411	        text: copy.cta ? `${copy.body}\n\n[${copy.cta.label}](${copy.cta.href})` : copy.body,
   412	        isError: true,
   413	        createdAt: Date.now(),
   414	      });
   415	    } finally {
   416	      setShareLoading(false);
   417	    }
   418	  }, [addMessage, copyShareUrl, sessionId, shareLoading, t, tOr, userPlan]);
   419	
   420	  const handleShareAnswer = useCallback(async (message: Message) => {
   421	    if (!message.shareAnchor || shareAnswerLoadingId) return;
   422	    setShareAnswerLoadingId(message.id);
   423	    try {
   424	      const { createShare } = await import('../../lib/api');
   425	      const result = await createShare(sessionId);
   426	      const answerUrl = withShareAnchor(result.url, message.shareAnchor);
   427	      await copyShareUrl(answerUrl);
   428	      trackEvent('share_created', { source: 'answer_action', plan: userPlan || 'unknown' });
   429	      addMessage({
   430	        id: `m_${Date.now()}_share_answer_ok`,
   431	        role: 'assistant',
   432	        text: tOr('share.answerCopied', 'Answer link copied to clipboard.'),
   433	        createdAt: Date.now(),
   434	      });
   435	    } catch (e) {
   436	      console.error('Answer share failed:', e);
   437	      const copy = errorCopy(e, t, tOr);
   438	      addMessage({
   439	        id: `m_${Date.now()}_share_answer_err`,
   440	        role: 'assistant',
   441	        text: copy.cta ? `${copy.body}\n\n[${copy.cta.label}](${copy.cta.href})` : copy.body,
   442	        isError: true,
   443	        createdAt: Date.now(),
   444	      });
   445	    } finally {
   446	      setShareAnswerLoadingId(null);
   447	    }
   448	  }, [addMessage, copyShareUrl, sessionId, shareAnswerLoadingId, t, tOr, userPlan]);
   449	
   450	  // Stable refs for the per-message row callbacks (I21). Previously the
   451	  // arrow functions `() => void regenerateLastResponse()` / `() => void
   452	  // continueGenerating()` / `(msg) => void handleShareAnswer(msg)` were
   453	  // recreated on every render of `ChatPanel`, and `ChatPanel` re-renders
   454	  // every ~50ms during SSE streaming (because the store's messages array
   455	  // mutates on every text flush). Even with `MessageBubble` memoized,
   456	  // those fresh arrow identities broke shallow-prop comparison and
   457	  // forced every historical message to re-run ReactMarkdown + Shiki at
   458	  // streaming cadence — O(n) work per flush. With these stabilized,
   459	  // only the actively-streaming message (the one whose `.text` ref
   460	  // changed) re-renders. The underlying mutations are already
   461	  // useCallback'd in `useChatStream`, so these wrappers stay stable
   462	  // across streaming flushes.
   463	  const handleRegenerateLast = useCallback(() => {
   464	    void regenerateLastResponse();
   465	  }, [regenerateLastResponse]);
   466	  const handleContinueLast = useCallback(() => {
   467	    void continueGenerating();
   468	  }, [continueGenerating]);
   469	  const handleShareAnswerVoid = useCallback((msg: Message) => {
   470	    void handleShareAnswer(msg);
   620	              </button>
   621	            </div>
   622	          )}
   623	        </div>
   624	      )}
   625	
   626	      <form onSubmit={onSubmit} className="dt-composer-shell px-4 py-3 sm:px-6">
   627	        <div className="mx-auto max-w-4xl">
   628	          {userPlan && (
   629	            <div className="mb-2 flex justify-end">
   630	              <DomainModeSelector userPlan={userPlan} />
   631	            </div>
   632	          )}
   633	          <div className="dt-composer flex items-center gap-2 rounded-[1.75rem] px-3 py-2 transition-[border-color,box-shadow]">
   634	            <PlusMenu
   635	              isOpen={plusMenuOpen}
   636	              setIsOpen={setPlusMenuOpen}
   637	              menuRef={plusMenuRef}
   638	              buttonRef={plusMenuButtonRef}
   639	              onMenuKeyDown={handlePlusMenuKeyDown}
   640	              showCustomInstructions={showCustomInstructions}
   641	              showExportInMenu={showExportInMenu}
   642	              canUseCustomInstructions={canUseCustomInstructions}
   643	              hasCustomInstructions={hasCustomInstructions}
   644	              canUseExport={canUseExport}
   645	              onOpenSettings={onOpenSettings}
   646	              onExport={handleExport}
   647	              onExportPdf={() => handleExportFormat('pdf')}
   648	              onExportDocx={() => handleExportFormat('docx')}
   649	              onBillingRedirect={(intent) => {
   650	                setPlusMenuOpen(false);
   651	                trackEvent('upgrade_click', {
   652	                  plan: intent.plan,
   653	                  period: 'monthly',
   654	                  source: 'chat_plus_menu',
   655	                  reason: intent.reason,
   656	                });
   657	                router.push(billingHref({ plan: intent.plan, source: 'chat_plus_menu', reason: intent.reason }));
   658	              }}
   659	              t={t}
   660	              tOr={tOr}
   661	            />
   662	            {messages.length > 0 && !isStreaming && (
   663	              <button
   664	                type="button"
   665	                onClick={userPlan ? handleShare : handleAnonShareClick}
   666	                disabled={shareLoading}
   667	                className="rounded-full p-1.5 text-[var(--workbench-muted)] transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50"
   668	                title={userPlan ? tOr('chat.share', 'Share conversation') : tOr('chat.shareSignIn', 'Sign in to share this conversation')}
   669	                aria-label={userPlan ? tOr('chat.share', 'Share conversation') : tOr('chat.shareSignIn', 'Sign in to share this conversation')}
   670	              >
   671	                <Share2 size={16} />
   672	              </button>
   673	            )}
   674	            <textarea
   675	              ref={textareaRef}
   676	              className="flex-1 resize-none overflow-y-auto bg-transparent px-1 py-1 text-sm text-[var(--workbench-ink)] placeholder:text-zinc-400 dark:placeholder:text-white/38 focus:outline-none"
   677	              style={{ minHeight: '36px' }}
   678	              placeholder={demoLimitReached ? t('demo.signInToContinue') : t('chat.placeholder')}
   679	              value={input}
   680	              onChange={(e) => setInput(e.target.value)}
   681	              onKeyDown={onKeyDown}
   682	              disabled={isStreaming || demoLimitReached}
   683	              rows={1}
   684	              aria-label={t('chat.placeholder')}
   685	            />
   686	            <div className="flex items-center shrink-0">
   687	              {isStreaming ? (
   688	                <button
   689	                  type="button"
   690	                  onClick={stopStreaming}
   691	                  className="dt-stitch-primary rounded-full p-2 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   692	                  title={tOr('chat.stop', 'Stop')}
   693	                  aria-label={t('chat.stop')}
   694	                >
   695	                  <Square size={16} />
   696	                </button>
   697	              ) : (
   698	                <button
   699	                  type="submit"
   700	                  className="dt-stitch-primary rounded-full p-2 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
   701	                  disabled={!input.trim() || demoLimitReached}
   702	                  title={t('chat.send')}
   703	                  aria-label={t('chat.send')}
   704	                >
   705	                  <SendHorizontal size={18} />
   706	                </button>
   707	              )}
   708	            </div>
   709	          </div>
   710	        </div>
   711	      </form>
   712	
   713	      <div className="bg-transparent pb-2 text-center">
   714	        <p className="mx-auto max-w-4xl text-xs text-zinc-400 dark:text-zinc-500">
   715	          {t('chat.disclaimer')}
   716	        </p>
   717	      </div>
   718	    </div>
   719	  );
   720	}
     1	"use client";
     2	
     3	import React, { Suspense, useMemo, useState, useCallback, useEffect } from 'react';
     4	import remarkGfm from 'remark-gfm';
     5	import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw, ChevronsDown, Share2, Quote } from 'lucide-react';
     6	import type { ChatArtifact, Citation, Message } from '../../types';
     7	import { useLocale } from '../../i18n';
     8	import CitationPopover from './CitationPopover';
     9	import SourcesStrip from './SourcesStrip';
    10	import ChatArtifactCard from './ChatArtifactCard';
    11	import { highlightCode } from '../../lib/highlight';
    12	import { CopyButton } from '../spell';
    13	import { trackEvent } from '../../lib/analytics';
    14	
    15	const ReactMarkdown = React.lazy(() => import('react-markdown'));
    16	
    17	interface MessageBubbleProps {
    18	  message: Message;
    19	  onCitationClick?: (c: Citation) => void;
    20	  onPreviewLayoutTranslation?: (url: string, artifact: ChatArtifact) => void;
    21	  isStreaming?: boolean;
    22	  onRegenerate?: () => void;
    23	  isLastAssistant?: boolean;
    24	  onContinue?: () => void;
    25	  onShareAnswer?: (message: Message) => void;
    26	  isSharingAnswer?: boolean;
    27	  /** True when `onShareAnswer` is the anonymous conversion-affordance handler
    28	   *  (not a working share) — swaps the button's copy to "Sign in to share". */
    29	  isAnonShareAnswer?: boolean;
    30	  /** Opens the Quote Finder panel prefilled with a topic (FIX3-B chip).
    31	   * Undefined on surfaces that don't wire a panel (e.g. collection chat),
    32	   * in which case the chip simply never renders. */
    33	  onTryQuoteFinder?: (topic: string) => void;
    34	}
    35	
    36	function insertCitationMarkers(text: string, citations: Citation[]): string {
    37	  if (!citations || citations.length === 0) return text;
    38	  const sorted = [...citations].sort((a, b) => b.offset - a.offset);
    39	  let result = text;
    40	  for (const c of sorted) {
    41	    const idx = Math.max(0, Math.min(result.length, c.offset));
    42	    result = result.slice(0, idx) + `[${c.refIndex}]` + result.slice(idx);
    43	  }
    44	  return result;
    45	}
    46	
    47	function processCitationLinks(
    48	  children: React.ReactNode,
    49	  citations: Citation[],
    50	  onClick?: (c: Citation) => void,
    51	  t?: (key: string, params?: Record<string, string | number>) => string,
    52	): React.ReactNode {
    53	  if (!citations || citations.length === 0) return children;
    54	
    55	  return React.Children.map(children, (child) => {
    56	    if (typeof child === 'string') {
    57	      const parts: React.ReactNode[] = [];
    58	      const regex = /\[(\d+)\]/g;
    59	      let lastIndex = 0;
    60	      let match: RegExpExecArray | null;
    61	      let keyIdx = 0;
    62	
    63	      while ((match = regex.exec(child)) !== null) {
    64	        if (match.index > lastIndex) {
    65	          parts.push(child.slice(lastIndex, match.index));
    66	        }
    67	        const refNum = parseInt(match[1], 10);
    68	        const citation = citations.find((c) => c.refIndex === refNum);
    69	        if (citation) {
    70	          parts.push(
    71	            <CitationPopover key={`cite-${refNum}-${keyIdx++}`} citation={citation}>
    72	              <button
    73	                type="button"
    74	                className="not-prose dt-source-index align-super mx-0.5 inline-flex h-[1.125rem] min-w-[1.125rem] cursor-pointer select-none items-center justify-center rounded px-1 text-[10px] font-semibold leading-none transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)]"
    75	                onClick={() => onClick?.(citation)}
    76	                title={t ? t('citation.jumpTo', { page: citation.page }) : `Jump to page ${citation.page}`}
    77	              >
    78	                {refNum}
    79	              </button>
    80	            </CitationPopover>
    81	          );
    82	        } else {
    83	          parts.push(`[${refNum}]`);
    84	        }
    85	        lastIndex = regex.lastIndex;
    86	      }
    87	      if (lastIndex < child.length) {
    88	        parts.push(child.slice(lastIndex));
    89	      }
    90	      return parts.length === 1 ? parts[0] : <>{parts}</>;
    91	    }
    92	
    93	    if (React.isValidElement(child) && child.props?.children) {
    94	      const elementType = (child as any).type;
    95	      // Don't recurse into literal code / anchors / keyboard / sample spans.
    96	      // Otherwise an LLM emitting `[1]` inside a backtick code span would have
    97	      // the marker rewritten into a <CitationPopover><button>, producing a
    98	      // button-inside-code-element semantic mess (and breaking copy-paste of
    99	      // the literal code).
   100	      if (
   101	        typeof elementType === 'string'
   102	        && ['code', 'pre', 'a', 'kbd', 'samp'].includes(elementType)
   103	      ) {
   104	        return child;
   105	      }
   106	      return React.cloneElement(child as React.ReactElement<any>, {
   107	        children: processCitationLinks(child.props.children, citations, onClick, t),
   108	      });
   109	    }
   110	
   111	    return child;
   112	  });
   113	}
   114	
   115	function createCitationComponent(
   116	  Tag: string,
   117	  citations: Citation[],
   118	  onClick?: (c: Citation) => void,
   119	  t?: (key: string, params?: Record<string, string | number>) => string,
   120	) {
   121	  return function CitationElement({ children, ...props }: any) {
   122	    return React.createElement(Tag, props, processCitationLinks(children, citations, onClick, t));
   123	  };
   124	}
   125	
   126	/* ── Code block with header + copy button + Shiki highlighting ── */
   127	function CodeBlock({ language, code }: { language: string; code: string }) {
   128	  const [html, setHtml] = useState<string | null>(null);
   129	  const { t } = useLocale();
   130	
   131	  useEffect(() => {
   132	    let cancelled = false;
   133	    setHtml(null);
   134	    highlightCode(code, language)
   135	      .then((out) => {
   136	        if (!cancelled) setHtml(out);
   137	      })
   138	      .catch(() => {
   139	        if (!cancelled) setHtml(null);
   140	      });
   141	    return () => {
   142	      cancelled = true;
   143	    };
   144	  }, [code, language]);
   145	
   146	  return (
   147	    <div className="not-prose my-4 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
   148	      <div className="flex items-center justify-between px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
   149	        <span className="font-mono">{language || 'text'}</span>
   150	        <CopyButton value={code} label={t('chat.copyCode')} copiedLabel={t('chat.copied')} />
   151	      </div>
   152	      {html ? (
   153	        <div
   154	          className="shiki-container text-[13px] leading-relaxed [&_pre]:!m-0 [&_pre]:!p-4 [&_pre]:overflow-x-auto"
   155	          dangerouslySetInnerHTML={{ __html: html }}
   156	        />
   157	      ) : (
   158	        <pre className="text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 overflow-x-auto p-4 m-0">
   159	          <code>{code}</code>
   160	        </pre>
   161	      )}
   162	    </div>
   163	  );
   164	}
   165	
   166	/* ── Pre override: render fenced code blocks as CodeBlock ── */
   167	function PreBlock({ children }: any) {
   168	  const child = React.Children.toArray(children)[0];
   169	  if (React.isValidElement(child)) {
   170	    const childProps = (child as any).props || {};
   171	    const className = childProps.className || '';
   172	    const match = /language-(\w+)/.exec(className);
   173	    const lang = match ? match[1] : '';
   174	    const text = String(childProps.children ?? '').replace(/\n$/, '');
   175	    if (text) {
   176	      return <CodeBlock language={lang} code={text} />;
   177	    }
   178	  }
   179	  return <pre className="overflow-x-auto">{children}</pre>;
   180	}
   181	
   182	type Feedback = 'up' | 'down' | null;
   183	
   184	function getFeedback(messageId: string): Feedback {
   185	  try {
   186	    return localStorage.getItem(`doctalk_fb_${messageId}`) as Feedback;
   187	  } catch {
   188	    // localStorage unavailable in private browsing
   189	    return null;
   190	  }
   191	}
   192	
   193	function setFeedbackStorage(messageId: string, fb: Feedback) {
   194	  try {
   195	    if (fb) {
   196	      localStorage.setItem(`doctalk_fb_${messageId}`, fb);
   197	    } else {
   198	      localStorage.removeItem(`doctalk_fb_${messageId}`);
   199	    }
   200	  } catch {
   201	    // localStorage unavailable in private browsing
   202	  }
   203	}
   204	
   205	function MessageBubble({
   206	  message,
   207	  onCitationClick,
   208	  onPreviewLayoutTranslation,
   209	  isStreaming,
   210	  onRegenerate,
   211	  isLastAssistant,
   212	  onContinue,
   213	  onShareAnswer,
   214	  isSharingAnswer,
   215	  isAnonShareAnswer,
   216	  onTryQuoteFinder,
   217	}: MessageBubbleProps) {
   218	  const isUser = message.role === 'user';
   219	  const isError = !!message.isError;
   220	  const isAssistant = !isUser;
   221	  const { t } = useLocale();
   222	
   223	  const [copied, setCopied] = useState(false);
   224	  const [feedback, setFeedback] = useState<Feedback>(null);
   225	
   226	  useEffect(() => {
   227	    if (isAssistant) {
   228	      setFeedback(getFeedback(message.id));
   229	    }
   230	  }, [message.id, isAssistant]);
   231	
   232	  const handleCopy = useCallback(() => {
   233	    navigator.clipboard.writeText(message.text)
   234	      .then(() => {
   235	        setCopied(true);
   236	        setTimeout(() => setCopied(false), 2000);
   237	      })
   238	      .catch(() => {
   239	        // iOS Safari / non-HTTPS reject clipboard.writeText. The natural
   240	        // "didn't work" cue is the absence of the copied state — no toast
   241	        // needed. Swallowing prevents an unhandled promise rejection.
   242	      });
   243	  }, [message.text]);
   244	
   245	  const handleFeedback = useCallback((fb: Feedback) => {
   246	    const newFb = feedback === fb ? null : fb;
   247	    setFeedback(newFb);
   248	    setFeedbackStorage(message.id, newFb);
   249	    if (newFb) {
   250	      trackEvent('feedback_submitted', {
   251	        source: 'message_actions',
   252	        rating: newFb,
   253	        has_citations: Boolean(message.citations?.length),
   254	      });
   255	    }
   256	  }, [feedback, message.citations?.length, message.id]);
   257	
   258	  const markdownText = useMemo(() => {
   259	    if (isUser || isError) return message.text;
   260	    return insertCitationMarkers(message.text, message.citations || []);
   261	  }, [message.text, message.citations, isUser, isError]);
   262	
   263	  const markdownComponents = useMemo(() => {
   264	    const citations = message.citations || [];
   265	    const components: Record<string, any> = {
   266	      pre: PreBlock,
   267	    };
   268	    if (citations.length > 0) {
   269	      const tags = ['p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'blockquote'] as const;
   270	      for (const tag of tags) {
   271	        components[tag] = createCitationComponent(tag, citations, onCitationClick, t);
   272	      }
   273	    }
   274	    return components;
   275	  }, [message.citations, onCitationClick, t]);
   276	
   277	  return (
   278	    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} ${isUser ? 'my-4' : 'my-6'} group`}>
   279	      <div className={`relative ${isUser ? 'max-w-[80%]' : 'w-full'}`}>
   280	        <div
frontend/src/components/Chat/ChatPanel.tsx:27: * — doesn't force every prior message to re-run ReactMarkdown + Shiki
frontend/src/components/Chat/ChatPanel.tsx:352:      a.href = url;
frontend/src/components/Chat/ChatPanel.tsx:411:        text: copy.cta ? `${copy.body}\n\n[${copy.cta.label}](${copy.cta.href})` : copy.body,
frontend/src/components/Chat/ChatPanel.tsx:441:        text: copy.cta ? `${copy.body}\n\n[${copy.cta.label}](${copy.cta.href})` : copy.body,
frontend/src/components/Chat/ChatPanel.tsx:457:  // forced every historical message to re-run ReactMarkdown + Shiki at
frontend/src/components/AuthFormContent.tsx:281:        <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-50">{t("auth.termsOfService")}</a>
frontend/src/components/AuthFormContent.tsx:283:        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-50">{t("auth.privacyPolicy")}</a>.
frontend/src/components/Chat/ChatArtifactCard.tsx:339:                  href={layoutImportError.cta.href}
frontend/src/components/Chat/ChatArtifactCard.tsx:453:              href={proxiedArtifactUrl(item.url)}
frontend/src/components/Chat/ChatArtifactCard.tsx:463:                href={`/d/${importedDocumentId}`}
frontend/src/components/Chat/MessageBubble.tsx:4:import remarkGfm from 'remark-gfm';
frontend/src/components/Chat/MessageBubble.tsx:15:const ReactMarkdown = React.lazy(() => import('react-markdown'));
frontend/src/components/Chat/MessageBubble.tsx:317:                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
frontend/src/components/Chat/MessageBubble.tsx:319:                  </ReactMarkdown>
frontend/src/components/Chat/MessageBubble.tsx:438: * historical messages — keeping per-flush ReactMarkdown + Shiki work O(1)
frontend/src/components/Extraction/ExtractionPanel.tsx:84:  a.href = url;
frontend/src/components/Extraction/ExtractionPanel.tsx:474:                    href={billingHref({ plan: "plus", source: "extraction_panel", reason: paywallCode.toLowerCase() })}
frontend/src/components/Extraction/ExtractionPanel.tsx:623:              href={billingHref({ plan: "plus", source: "tables_panel", reason: paywallCode.toLowerCase() })}
frontend/src/components/Chat/CollectionCitationCard.tsx:54:              href={originalHref}
frontend/src/components/Chat/CitationPopover.tsx:74:              href={originalHref}
frontend/src/components/Collections/CreateCollectionModal.tsx:77:          reason: copy.cta.href.includes('collection_doc_limit') ? 'collection_doc_limit' : 'collection_limit',
frontend/src/components/Collections/CreateCollectionModal.tsx:207:                href={createErrorCopy.cta.href}
frontend/src/components/Collections/CollectionList.tsx:87:            href={`/collections/${c.id}`}
frontend/src/components/Diff/DocumentDiffPanel.tsx:78:  a.href = url;
frontend/src/components/Diff/DocumentDiffPanel.tsx:420:                href={billingHref({ plan: "pro", source: collectionId ? "collection_reader" : "compare_page", reason: "document_diff" })}
frontend/src/components/Diff/DocumentDiffPanel.tsx:668:                href={billingHref({ plan: "pro", source: collectionId ? "collection_reader" : "compare_page", reason: "document_diff" })}
frontend/src/components/FeedbackButton.tsx:156:      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
frontend/src/components/seo/CTABanner.tsx:11:  href: string;
frontend/src/components/seo/CTABanner.tsx:15:export default function CTABanner({ title, description, buttonText, href, variant = 'default' }: CTABannerProps) {
frontend/src/components/seo/CTABanner.tsx:33:              href={href}
frontend/src/components/seo/CTABanner.tsx:73:          href={href}
frontend/src/components/dashboard/DashboardPageClient.tsx:235:          href: billingHref({ plan: uploadUpgradePlan, source: 'limit', reason: 'file_size' }),
frontend/src/components/dashboard/DashboardPageClient.tsx:305:        trackEvent('limit_hit', { source: 'dashboard_upload', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'upload_limit', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx:348:        trackEvent('limit_hit', { source: 'dashboard_url', reason: copy.cta.href.includes('file_size') ? 'file_size' : 'url_limit', plan: userPlan });
frontend/src/components/dashboard/DashboardPageClient.tsx:409:	                    href={billingHref({ plan: 'plus', source: 'dashboard_upgrade_reminder', reason: 'sustained_free_usage' })}
frontend/src/components/dashboard/DashboardPageClient.tsx:461:                    href={uploadErrorCopy.cta.href}
frontend/src/components/dashboard/DashboardPageClient.tsx:500:                  href={urlErrorCopy.cta.href}
frontend/src/components/dashboard/DashboardPageClient.tsx:511:            <Link href="/demo" className="text-[var(--workbench-muted)] hover:text-zinc-900 dark:hover:text-white text-sm transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm">
frontend/src/components/dashboard/DashboardPageClient.tsx:522:                href="/document-diff"
frontend/src/components/dashboard/DashboardPageClient.tsx:529:                href="/collections"
frontend/src/components/dashboard/DashboardPageClient.tsx:558:                  href="/collections?action=create&select=ready"
frontend/src/components/dashboard/DashboardPageClient.tsx:579:                  href="/demo"
frontend/src/components/dashboard/DashboardPageClient.tsx:603:                    <Link href={`/d/${d.document_id}`} className="flex-1 min-w-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-lg">
frontend/src/components/dashboard/DashboardPageClient.tsx:617:                        href={`/d/${d.document_id}`}
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:57:  a.href = url;
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:438:                    href={billingHref({ plan: upgradePlan, source: "question_templates", reason: paywall.code.toLowerCase() })}
frontend/src/components/Footer.tsx:26:    { href: '/demo', label: t('footer.demo') },
frontend/src/components/Footer.tsx:27:    { href: '/pricing', label: t('footer.pricing') },
frontend/src/components/Footer.tsx:28:    { href: '/features', label: t('footer.links.features') },
frontend/src/components/Footer.tsx:29:    { href: '/features/free-demo', label: t('footer.links.noSignupDemo') },
frontend/src/components/Footer.tsx:30:    { href: '/features/citations', label: t('footer.links.citationHighlighting') },
frontend/src/components/Footer.tsx:31:    { href: '/features/performance-modes', label: t('footer.links.performanceModes') },
frontend/src/components/Footer.tsx:34:    { href: '/use-cases', label: t('footer.links.useCases') },
frontend/src/components/Footer.tsx:35:    { href: '/use-cases/students', label: t('footer.links.students') },
frontend/src/components/Footer.tsx:36:    { href: '/use-cases/lawyers', label: t('footer.links.lawyers') },
frontend/src/components/Footer.tsx:37:    { href: '/use-cases/finance', label: t('footer.links.finance') },
frontend/src/components/Footer.tsx:38:    { href: '/use-cases/hr-contracts', label: t('footer.links.hrContracts') },
frontend/src/components/Footer.tsx:41:    { href: '/compare', label: t('footer.links.compareTools') },
frontend/src/components/Footer.tsx:42:    { href: '/alternatives', label: t('footer.links.alternatives') },
frontend/src/components/Footer.tsx:43:    { href: '/blog', label: t('footer.links.blog') },
frontend/src/components/Footer.tsx:44:    { href: '/blog/category/comparisons', label: t('footer.links.comparisonGuides') },
frontend/src/components/Footer.tsx:45:    { href: '/features/multi-format', label: t('footer.links.multiFormatSupport') },
frontend/src/components/Footer.tsx:48:    { href: '/about', label: t('footer.links.about') },
frontend/src/components/Footer.tsx:49:    { href: '/contact', label: t('footer.contact') },
frontend/src/components/Footer.tsx:50:    { href: '/trust', label: t('footer.links.trust') },
frontend/src/components/Footer.tsx:51:    { href: '/privacy', label: t('privacy.policyLink') },
frontend/src/components/Footer.tsx:52:    { href: '/terms', label: t('terms.title') },
frontend/src/components/Footer.tsx:53:    { href: '/imprint', label: tOr('footer.imprint', 'Imprint') },
frontend/src/components/Footer.tsx:54:    { href: '/privacy#ccpa', label: t('footer.doNotSell') },
frontend/src/components/Footer.tsx:63:            <Link href="/" className="inline-flex items-center gap-2.5 hover:opacity-80 transition-opacity">
frontend/src/components/Footer.tsx:80:                  <li key={item.href}>
frontend/src/components/Footer.tsx:81:                    <Link href={item.href} className="text-sm text-zinc-500 dark:text-zinc-300 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
frontend/src/components/Footer.tsx:95:                  <li key={item.href}>
frontend/src/components/Footer.tsx:96:                    <Link href={item.href} className="text-sm text-zinc-500 dark:text-zinc-300 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
frontend/src/components/Footer.tsx:110:                  <li key={item.href}>
frontend/src/components/Footer.tsx:111:                    <Link href={item.href} className="text-sm text-zinc-500 dark:text-zinc-300 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
frontend/src/components/Footer.tsx:125:                  <li key={item.href}>
frontend/src/components/Footer.tsx:126:                    <Link href={item.href} className="text-sm text-zinc-500 dark:text-zinc-300 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded-sm">
frontend/src/components/Footer.tsx:161:              href="https://github.com/Rswcf/DocTalk"
frontend/src/components/PaywallModal.tsx:81:    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
frontend/src/components/PaywallModal.tsx:151:            href={billingHref({ plan: targetPlan, source: 'paywall_modal', reason: copy.reason })}
frontend/src/components/PrivacyBadge.tsx:33:        href="/trust"
frontend/src/components/marketing/EdCtaBanner.tsx:5:  href: string;
frontend/src/components/marketing/EdCtaBanner.tsx:58:            <Link href={primary.href} className="ed-cta">
frontend/src/components/marketing/EdCtaBanner.tsx:63:              <Link href={secondary.href} className="ed-link">
frontend/src/components/landing/EditorialFooter.tsx:51:    { href: lh("/demo"), label: L.demo },
frontend/src/components/landing/EditorialFooter.tsx:52:    { href: lh("/pricing"), label: L.pricing },
frontend/src/components/landing/EditorialFooter.tsx:53:    { href: lh("/features"), label: L.features },
frontend/src/components/landing/EditorialFooter.tsx:54:    { href: lh("/features/free-demo"), label: L.noSignupDemo },
frontend/src/components/landing/EditorialFooter.tsx:55:    { href: lh("/features/citations"), label: L.citationHighlighting },
frontend/src/components/landing/EditorialFooter.tsx:56:    { href: lh("/features/performance-modes"), label: L.performanceModes },
frontend/src/components/landing/EditorialFooter.tsx:60:    { href: lh("/use-cases"), label: L.useCasesLink },
frontend/src/components/landing/EditorialFooter.tsx:61:    { href: lh("/use-cases/students"), label: L.students },
frontend/src/components/landing/EditorialFooter.tsx:62:    { href: lh("/use-cases/lawyers"), label: L.lawyers },
frontend/src/components/landing/EditorialFooter.tsx:63:    { href: lh("/use-cases/finance"), label: L.finance },
frontend/src/components/landing/EditorialFooter.tsx:64:    { href: lh("/use-cases/hr-contracts"), label: L.hrContracts },
frontend/src/components/landing/EditorialFooter.tsx:68:    { href: lh("/compare"), label: L.compareTools },
frontend/src/components/landing/EditorialFooter.tsx:69:    { href: lh("/alternatives"), label: L.alternatives },
frontend/src/components/landing/EditorialFooter.tsx:70:    { href: lh("/blog"), label: L.blog },
frontend/src/components/landing/EditorialFooter.tsx:71:    { href: lh("/blog/category/comparisons"), label: L.comparisonGuides },
frontend/src/components/landing/EditorialFooter.tsx:72:    { href: lh("/features/multi-format"), label: L.multiFormatSupport },
frontend/src/components/landing/EditorialFooter.tsx:76:    { href: lh("/about"), label: L.about },
frontend/src/components/landing/EditorialFooter.tsx:77:    { href: lh("/contact"), label: L.contact },
frontend/src/components/landing/EditorialFooter.tsx:78:    { href: lh("/trust"), label: L.trust },
frontend/src/components/landing/EditorialFooter.tsx:79:    { href: lh("/imprint"), label: L.imprint },
frontend/src/components/landing/EditorialFooter.tsx:83:    { href: lh("/privacy"), label: L.privacy },
frontend/src/components/landing/EditorialFooter.tsx:84:    { href: lh("/terms"), label: L.terms },
frontend/src/components/landing/EditorialFooter.tsx:85:    { href: lh("/privacy#ccpa"), label: L.doNotSell },
frontend/src/components/landing/EditorialFooter.tsx:102:    links: { href: string; label: string }[];
frontend/src/components/landing/EditorialFooter.tsx:109:            <li key={item.href}>
frontend/src/components/landing/EditorialFooter.tsx:111:                href={item.href}
frontend/src/components/landing/EditorialFooter.tsx:144:              href={lh("/")}
frontend/src/components/landing/EditorialFooter.tsx:185:                key={item.href}
frontend/src/components/landing/EditorialFooter.tsx:186:                href={item.href}
frontend/src/components/marketing/EditorialHeaderBase.tsx:15:  href?: string;
frontend/src/components/marketing/EditorialHeaderBase.tsx:55:    { href: navHref("/features"), label: labels.features },
frontend/src/components/marketing/EditorialHeaderBase.tsx:56:    { href: navHref("/pricing"), label: labels.pricing },
frontend/src/components/marketing/EditorialHeaderBase.tsx:57:    { href: navHref("/trust"), label: labels.trust },
frontend/src/components/marketing/EditorialHeaderBase.tsx:73:              href={navHref("/")}
frontend/src/components/marketing/EditorialHeaderBase.tsx:132:                  key={item.href}
frontend/src/components/marketing/EditorialHeaderBase.tsx:133:                  href={item.href}
frontend/src/components/marketing/EditorialHeaderBase.tsx:181:                href="/auth"
frontend/src/components/marketing/EditorialHeaderBase.tsx:206:              key={item.href}
frontend/src/components/marketing/EditorialHeaderBase.tsx:207:              href={item.href}
frontend/src/components/marketing/EditorialHeaderBase.tsx:247:                    {crumb.href && !isLast ? (
frontend/src/components/marketing/EditorialHeaderBase.tsx:248:                      <Link href={crumb.href} className="ed-crumb">
frontend/src/components/ui/EmptyState.tsx:62:              href={actionHref}
frontend/src/components/landing/HeroSection.tsx:49:                href="/demo"
frontend/src/components/landing/HeroSection.tsx:60:                href="#auth"
frontend/src/components/landing/FinalCTA.tsx:24:                href="/demo"
frontend/src/components/landing/FinalCTA.tsx:35:                href="#auth"
frontend/src/components/marketing/TrackedCtaLink.tsx:16:  href,
frontend/src/components/marketing/TrackedCtaLink.tsx:22:  href: string;
frontend/src/components/marketing/TrackedCtaLink.tsx:30:      href={href}
frontend/src/components/Chat/ChatPanel.tsx:27: * — doesn't force every prior message to re-run ReactMarkdown + Shiki
frontend/src/components/Chat/ChatPanel.tsx:352:      a.href = url;
frontend/src/components/Chat/ChatPanel.tsx:411:        text: copy.cta ? `${copy.body}\n\n[${copy.cta.label}](${copy.cta.href})` : copy.body,
frontend/src/components/Chat/ChatPanel.tsx:441:        text: copy.cta ? `${copy.body}\n\n[${copy.cta.label}](${copy.cta.href})` : copy.body,
frontend/src/components/Chat/ChatPanel.tsx:457:  // forced every historical message to re-run ReactMarkdown + Shiki at
frontend/src/components/AuthModal.tsx:36:    const url = new URL(window.location.href);
frontend/src/components/AuthModal.tsx:64:    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
frontend/src/components/Chat/MessageBubble.tsx:4:import remarkGfm from 'remark-gfm';
frontend/src/components/Chat/MessageBubble.tsx:15:const ReactMarkdown = React.lazy(() => import('react-markdown'));
frontend/src/components/Chat/MessageBubble.tsx:317:                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
frontend/src/components/Chat/MessageBubble.tsx:319:                  </ReactMarkdown>
frontend/src/components/Chat/MessageBubble.tsx:438: * historical messages — keeping per-flush ReactMarkdown + Shiki work O(1)
frontend/src/components/marketing/EdPageHero.tsx:7:  primaryCta?: { label: string; href: string };
frontend/src/components/marketing/EdPageHero.tsx:8:  secondaryCta?: { label: string; href: string };
frontend/src/components/marketing/EdPageHero.tsx:68:                <Link href={primaryCta.href} className="ed-cta">
frontend/src/components/marketing/EdPageHero.tsx:73:                <Link href={secondaryCta.href} className="ed-link">
frontend/src/components/Chat/CollectionCitationCard.tsx:54:              href={originalHref}
frontend/src/components/Chat/ChatArtifactCard.tsx:339:                  href={layoutImportError.cta.href}
frontend/src/components/Chat/ChatArtifactCard.tsx:453:              href={proxiedArtifactUrl(item.url)}
frontend/src/components/Chat/ChatArtifactCard.tsx:463:                href={`/d/${importedDocumentId}`}
frontend/src/components/marketing/EdRelatedLinks.tsx:4:  href: string;
frontend/src/components/marketing/EdRelatedLinks.tsx:22:          <Link key={`rl-${index}`} href={link.href} className="ed-link">
frontend/src/components/Chat/CitationPopover.tsx:74:              href={originalHref}
frontend/src/components/marketing/MarketingLocaleLinks.tsx:8: * never click. This component puts the real `<a href="/de/...">` anchors in the
frontend/src/components/marketing/MarketingLocaleLinks.tsx:10: * language version. Belt-and-suspenders alongside hreflang + sitemap (and the
frontend/src/components/marketing/MarketingLocaleLinks.tsx:11: * primary discovery path for engines that handle hreflang poorly, e.g. Baidu).
frontend/src/components/marketing/MarketingLocaleLinks.tsx:22:            <a href={localizedHref(code, path)} hrefLang={code}>
frontend/src/components/CookieConsentBanner.tsx:90:            href="/privacy"
frontend/src/components/marketing/EdChoiceList.tsx:7:    href: string;
frontend/src/components/marketing/EdChoiceList.tsx:38:            href={item.pick.href}
frontend/src/components/spell/FlowButton.tsx:12:type LinkishProps = BaseProps & { href: string; onClick?: never; type?: never; disabled?: never };
frontend/src/components/spell/FlowButton.tsx:14:  href?: never;
frontend/src/components/spell/FlowButton.tsx:43:  if ('href' in props && props.href !== undefined) {
frontend/src/components/spell/FlowButton.tsx:44:    const external = props.href.startsWith('http');
frontend/src/components/spell/FlowButton.tsx:47:        <a href={props.href} className={cls} target="_blank" rel="noreferrer noopener">
frontend/src/components/spell/FlowButton.tsx:53:      <Link href={props.href} className={cls}>
frontend/src/components/marketing/EdLanguageSelector.tsx:20: *   renders real `<a href="/de/...">` anchors for every marketing locale. This is
frontend/src/components/marketing/EdLanguageSelector.tsx:164:                  href={localizedHref(l.code, agnosticPath)}
frontend/src/components/marketing/EdLanguageSelector.tsx:165:                  hrefLang={l.code}
frontend/src/components/Profile/SavedQuotesSection.tsx:56:          href={`/d/${quote.documentId}?page=${quote.page}`}
frontend/src/components/Profile/AccountActionsSection.tsx:40:      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
frontend/src/components/Profile/AccountActionsSection.tsx:66:      a.href = url;
frontend/src/components/SessionDropdown.tsx:256:                    href={sessionErrorCopy.cta.href}
frontend/src/components/PublicHeader.tsx:16:    { href: '/features', label: t('public.nav.features') },
frontend/src/components/PublicHeader.tsx:17:    { href: '/use-cases', label: t('public.nav.useCases') },
frontend/src/components/PublicHeader.tsx:18:    { href: '/compare', label: t('public.nav.compare') },
frontend/src/components/PublicHeader.tsx:19:    { href: '/blog', label: t('public.nav.blog') },
frontend/src/components/PublicHeader.tsx:20:    { href: '/pricing', label: t('footer.pricing') },
frontend/src/components/PublicHeader.tsx:25:      <Link href="/" className="font-logo font-semibold text-xl text-[var(--workbench-ink)] hover:text-zinc-950 dark:hover:text-white transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm inline-flex items-center gap-2">
frontend/src/components/PublicHeader.tsx:34:            key={item.href}
frontend/src/components/PublicHeader.tsx:35:            href={item.href}
frontend/src/components/PublicHeader.tsx:57:          href="/demo"
frontend/src/components/PublicHeader.tsx:64:          href="/auth"
frontend/src/components/PublicHeader.tsx:78:            {[...publicNav, { href: '/demo', label: t('footer.demo') }].map((item) => (
frontend/src/components/PublicHeader.tsx:80:                key={item.href}
frontend/src/components/PublicHeader.tsx:81:                href={item.href}
frontend/src/components/Profile/CreditsSection.tsx:81:      window.location.href = res.portal_url;
frontend/src/components/AppHeaderShell.tsx:33:      <Link href="/" className="font-logo font-semibold text-lg sm:text-xl text-[var(--workbench-ink)] hover:text-zinc-950 dark:hover:text-white transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm inline-flex items-center gap-1.5 sm:gap-2">
frontend/src/components/AppHeaderShell.tsx:46:          href={`/d/${lastDocumentId}`}
frontend/src/components/AppHeaderShell.tsx:57:          href="/collections"
frontend/src/components/marketing/EdCardGrid.tsx:8:  href?: string;
frontend/src/components/marketing/EdCardGrid.tsx:49:        return item.href ? (
frontend/src/components/marketing/EdCardGrid.tsx:52:            href={item.href}
frontend/src/components/TextViewer/TextViewer.tsx:4:import remarkGfm from 'remark-gfm';
frontend/src/components/TextViewer/TextViewer.tsx:10:const ReactMarkdown = React.lazy(() => import('react-markdown'));
frontend/src/components/TextViewer/TextViewer.tsx:489:                href={sourceMeta.sourceUrl}
frontend/src/components/TextViewer/TextViewer.tsx:727:        ReactMarkdown render — the user saw the cited passage twice (raw +
frontend/src/components/TextViewer/TextViewer.tsx:733:        full inline highlighting via a remark plugin or AST post-processor
frontend/src/components/TextViewer/TextViewer.tsx:744:        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
frontend/src/lib/errorCopy.ts:17:  openPaywall?: boolean;
frontend/src/lib/errorCopy.ts:240:    openPaywall: true,
frontend/src/lib/errorCopy.ts:251:    openPaywall: true,
frontend/src/lib/errorCopy.ts:262:    openPaywall: true,
frontend/src/lib/errorCopy.ts:276:    openPaywall: true,
frontend/src/app/collections/[collectionId]/page.tsx:187:      const copy = errorCopy(e, t, tOr);
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:205:        setLayoutTranslationError(errorCopy(err, t, tOr));
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:84:  const sessionErrorCopy = sessionError ? errorCopy(sessionError, t, tOr) : null;
frontend/src/components/Chat/ChatArtifactCard.tsx:297:      setLayoutImportError(errorCopy(err, t, tOr));
frontend/src/components/Chat/ChatPanel.tsx:360:      const copy = errorCopy(e, t, tOr);
frontend/src/components/Chat/ChatPanel.tsx:407:      const copy = errorCopy(e, t, tOr);
frontend/src/components/Chat/ChatPanel.tsx:437:      const copy = errorCopy(e, t, tOr);
frontend/src/components/Collections/CreateCollectionModal.tsx:72:      const copy = errorCopy(e, t, tOr);
frontend/src/components/CustomInstructionsModal.tsx:82:      const copy = errorCopy(e, t, tOr);
frontend/src/components/CustomInstructionsModal.tsx:98:      const copy = errorCopy(e, t, tOr);
frontend/src/components/Quotes/QuoteFinderPanel.tsx:151:        const copy = errorCopy(err, t, tOr);
frontend/src/components/Quotes/QuoteFinderPanel.tsx:214:        const copy = errorCopy(err, t, tOr);
frontend/src/components/SessionDropdown.tsx:92:      const copy = errorCopy(e, t, tOr);
frontend/src/components/dashboard/DashboardPageClient.tsx:301:      const copy = errorCopy(e, t, tOr);
frontend/src/components/dashboard/DashboardPageClient.tsx:344:      const copy = errorCopy(e, t, tOr);
frontend/src/lib/errorCopy.ts:53:export function errorCopy(err: ErrorInput, t: TFn, tOr: TOrFn): ErrorCopy {
frontend/src/lib/useChatStream.ts:235:    const copy = errorCopy(err, t, tOr);
frontend/src/lib/useDocumentLoader.ts:122:              const copy = errorCopy(e, t, tOr);
frontend/src/lib/useDocumentLoader.ts:138:              const copy = errorCopy(e, t, tOr);
frontend/src/lib/useDocumentLoader.ts:71:        const copy = errorCopy(e, t, tOr);
frontend/src/lib/useDocumentLoader.ts:98:            const copy = errorCopy({ code, detail: {} }, t, tOr);

exec
/bin/zsh -lc "nl -ba frontend/src/components/Chat/MessageBubble.tsx | sed -n '100,355p'
nl -ba frontend/src/lib/api.ts | sed -n '1,100p;1100,1165p'
nl -ba frontend/src/components/Extraction/ExtractionPanel.tsx | sed -n '70,240p;430,510p'
nl -ba frontend/src/lib/errorCopy.ts | sed -n '380,480p'
rg -n --glob '*.{ts,tsx}' 'SHARE_LIMIT_REACHED|DOCUMENT_LIMIT_REACHED' frontend/src backend/app | sort" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   100	      if (
   101	        typeof elementType === 'string'
   102	        && ['code', 'pre', 'a', 'kbd', 'samp'].includes(elementType)
   103	      ) {
   104	        return child;
   105	      }
   106	      return React.cloneElement(child as React.ReactElement<any>, {
   107	        children: processCitationLinks(child.props.children, citations, onClick, t),
   108	      });
   109	    }
   110	
   111	    return child;
   112	  });
   113	}
   114	
   115	function createCitationComponent(
   116	  Tag: string,
   117	  citations: Citation[],
   118	  onClick?: (c: Citation) => void,
   119	  t?: (key: string, params?: Record<string, string | number>) => string,
   120	) {
   121	  return function CitationElement({ children, ...props }: any) {
   122	    return React.createElement(Tag, props, processCitationLinks(children, citations, onClick, t));
   123	  };
   124	}
   125	
   126	/* ── Code block with header + copy button + Shiki highlighting ── */
   127	function CodeBlock({ language, code }: { language: string; code: string }) {
   128	  const [html, setHtml] = useState<string | null>(null);
   129	  const { t } = useLocale();
   130	
   131	  useEffect(() => {
   132	    let cancelled = false;
   133	    setHtml(null);
   134	    highlightCode(code, language)
   135	      .then((out) => {
   136	        if (!cancelled) setHtml(out);
   137	      })
   138	      .catch(() => {
   139	        if (!cancelled) setHtml(null);
   140	      });
   141	    return () => {
   142	      cancelled = true;
   143	    };
   144	  }, [code, language]);
   145	
   146	  return (
   147	    <div className="not-prose my-4 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
   148	      <div className="flex items-center justify-between px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700">
   149	        <span className="font-mono">{language || 'text'}</span>
   150	        <CopyButton value={code} label={t('chat.copyCode')} copiedLabel={t('chat.copied')} />
   151	      </div>
   152	      {html ? (
   153	        <div
   154	          className="shiki-container text-[13px] leading-relaxed [&_pre]:!m-0 [&_pre]:!p-4 [&_pre]:overflow-x-auto"
   155	          dangerouslySetInnerHTML={{ __html: html }}
   156	        />
   157	      ) : (
   158	        <pre className="text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 overflow-x-auto p-4 m-0">
   159	          <code>{code}</code>
   160	        </pre>
   161	      )}
   162	    </div>
   163	  );
   164	}
   165	
   166	/* ── Pre override: render fenced code blocks as CodeBlock ── */
   167	function PreBlock({ children }: any) {
   168	  const child = React.Children.toArray(children)[0];
   169	  if (React.isValidElement(child)) {
   170	    const childProps = (child as any).props || {};
   171	    const className = childProps.className || '';
   172	    const match = /language-(\w+)/.exec(className);
   173	    const lang = match ? match[1] : '';
   174	    const text = String(childProps.children ?? '').replace(/\n$/, '');
   175	    if (text) {
   176	      return <CodeBlock language={lang} code={text} />;
   177	    }
   178	  }
   179	  return <pre className="overflow-x-auto">{children}</pre>;
   180	}
   181	
   182	type Feedback = 'up' | 'down' | null;
   183	
   184	function getFeedback(messageId: string): Feedback {
   185	  try {
   186	    return localStorage.getItem(`doctalk_fb_${messageId}`) as Feedback;
   187	  } catch {
   188	    // localStorage unavailable in private browsing
   189	    return null;
   190	  }
   191	}
   192	
   193	function setFeedbackStorage(messageId: string, fb: Feedback) {
   194	  try {
   195	    if (fb) {
   196	      localStorage.setItem(`doctalk_fb_${messageId}`, fb);
   197	    } else {
   198	      localStorage.removeItem(`doctalk_fb_${messageId}`);
   199	    }
   200	  } catch {
   201	    // localStorage unavailable in private browsing
   202	  }
   203	}
   204	
   205	function MessageBubble({
   206	  message,
   207	  onCitationClick,
   208	  onPreviewLayoutTranslation,
   209	  isStreaming,
   210	  onRegenerate,
   211	  isLastAssistant,
   212	  onContinue,
   213	  onShareAnswer,
   214	  isSharingAnswer,
   215	  isAnonShareAnswer,
   216	  onTryQuoteFinder,
   217	}: MessageBubbleProps) {
   218	  const isUser = message.role === 'user';
   219	  const isError = !!message.isError;
   220	  const isAssistant = !isUser;
   221	  const { t } = useLocale();
   222	
   223	  const [copied, setCopied] = useState(false);
   224	  const [feedback, setFeedback] = useState<Feedback>(null);
   225	
   226	  useEffect(() => {
   227	    if (isAssistant) {
   228	      setFeedback(getFeedback(message.id));
   229	    }
   230	  }, [message.id, isAssistant]);
   231	
   232	  const handleCopy = useCallback(() => {
   233	    navigator.clipboard.writeText(message.text)
   234	      .then(() => {
   235	        setCopied(true);
   236	        setTimeout(() => setCopied(false), 2000);
   237	      })
   238	      .catch(() => {
   239	        // iOS Safari / non-HTTPS reject clipboard.writeText. The natural
   240	        // "didn't work" cue is the absence of the copied state — no toast
   241	        // needed. Swallowing prevents an unhandled promise rejection.
   242	      });
   243	  }, [message.text]);
   244	
   245	  const handleFeedback = useCallback((fb: Feedback) => {
   246	    const newFb = feedback === fb ? null : fb;
   247	    setFeedback(newFb);
   248	    setFeedbackStorage(message.id, newFb);
   249	    if (newFb) {
   250	      trackEvent('feedback_submitted', {
   251	        source: 'message_actions',
   252	        rating: newFb,
   253	        has_citations: Boolean(message.citations?.length),
   254	      });
   255	    }
   256	  }, [feedback, message.citations?.length, message.id]);
   257	
   258	  const markdownText = useMemo(() => {
   259	    if (isUser || isError) return message.text;
   260	    return insertCitationMarkers(message.text, message.citations || []);
   261	  }, [message.text, message.citations, isUser, isError]);
   262	
   263	  const markdownComponents = useMemo(() => {
   264	    const citations = message.citations || [];
   265	    const components: Record<string, any> = {
   266	      pre: PreBlock,
   267	    };
   268	    if (citations.length > 0) {
   269	      const tags = ['p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'blockquote'] as const;
   270	      for (const tag of tags) {
   271	        components[tag] = createCitationComponent(tag, citations, onCitationClick, t);
   272	      }
   273	    }
   274	    return components;
   275	  }, [message.citations, onCitationClick, t]);
   276	
   277	  return (
   278	    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} ${isUser ? 'my-4' : 'my-6'} group`}>
   279	      <div className={`relative ${isUser ? 'max-w-[80%]' : 'w-full'}`}>
   280	        <div
   281	          className={
   282	            isError
   283	              ? 'text-sm rounded-2xl px-4 py-3 bg-red-500/92 text-white shadow-2xl shadow-red-950/30'
   284	              : isUser
   285	              ? 'dt-user-bubble text-sm rounded-2xl px-4 py-3'
   286	              : 'dt-answer-card text-[var(--workbench-ink)]'
   287	          }
   288	        >
   289	          {isUser ? (
   290	            <span className="whitespace-pre-wrap">{message.text}</span>
   291	          ) : isStreaming && !message.text ? (
   292	            <div className="flex items-center gap-2 text-[var(--workbench-muted)] text-sm" aria-live="polite">
   293	              <div className="flex gap-1">
   294	                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]" aria-hidden="true" />
   295	                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]" aria-hidden="true" />
   296	                <span className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce motion-reduce:animate-none" aria-hidden="true" />
   297	                <span className="hidden motion-reduce:inline" aria-hidden="true">...</span>
   298	              </div>
   299	              <span>{t('chat.searching')}</span>
   300	            </div>
   301	          ) : (
   302	            <>
   303	              {/* Sources strip — rendered above the prose so the
   304	                  "grounded-in-these-documents" signal is visible before the
   305	                  user reads the answer. During streaming with no citations
   306	                  yet, SourcesStrip itself draws a skeleton so the block
   307	                  doesn't flicker into existence mid-answer. */}
   308	              {isAssistant && (
   309	                <SourcesStrip
   310	                  citations={message.citations ?? []}
   311	                  onCitationClick={onCitationClick}
   312	                  isStreaming={isStreaming}
   313	                />
   314	              )}
   315	              <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 sm:prose-base">
   316	                <Suspense fallback={<span className="whitespace-pre-wrap">{markdownText}</span>}>
   317	                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
   318	                    {markdownText}
   319	                  </ReactMarkdown>
   320	                </Suspense>
   321	                {isStreaming && isAssistant && message.text && (
   322	                  <span aria-hidden="true" className="inline-block w-2 h-4 bg-zinc-400 dark:bg-white/45 animate-pulse motion-reduce:animate-none rounded-sm ml-0.5 align-text-bottom" />
   323	                )}
   324	              </div>
   325	              {isAssistant && !message.text && message.toolStatus ? (
   326	                <p className="mt-3 text-sm text-[var(--workbench-muted)]">{message.toolStatus}</p>
   327	              ) : null}
   328	              {isAssistant && message.artifacts?.map((artifact, index) => (
   329	                <ChatArtifactCard
   330	                  key={`${artifact.jobId || artifact.title}-${index}`}
   331	                  artifact={artifact}
   332	                  onCitationClick={onCitationClick}
   333	                  onPreviewLayoutTranslation={onPreviewLayoutTranslation}
   334	                />
   335	              ))}
   336	              {/* FIX3-B (Codex r3 #5): non-blocking nudge for a strict quote
   337	                  request that deliberately did NOT auto-route to billed
   338	                  Quote Finder (negation/metalinguistic token present) — a
   339	                  false negative here only costs one click, never money. */}
   340	              {isAssistant && !isStreaming && message.quoteFinderHint && message.quoteFinderTopic && onTryQuoteFinder && (
   341	                <button
   342	                  type="button"
   343	                  onClick={() => onTryQuoteFinder(message.quoteFinderTopic || '')}
   344	                  className="not-prose mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] px-3 py-1.5 text-sm font-medium text-[var(--reader-evidence)] transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[var(--reader-evidence)]"
   345	                >
   346	                  <Quote size={14} aria-hidden="true" />
   347	                  {t('quoteFinder.chip.tryIt')}
   348	                </button>
   349	              )}
   350	            </>
   351	          )}
   352	        </div>
   353	
   354	        {/* Copy + feedback buttons (assistant only) */}
   355	        {isAssistant && !isError && message.text && (
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
  1100	// --- URL Ingestion ---
  1101	
  1102	export async function ingestUrl(url: string): Promise<{ document_id: string; status: string; filename?: string }> {
  1103	  const res = await fetch(`${PROXY_BASE}/api/documents/ingest-url`, {
  1104	    method: 'POST',
  1105	    headers: { 'Content-Type': 'application/json' },
  1106	    body: JSON.stringify({ url }),
  1107	  });
  1108	  return handle(res);
  1109	}
  1110	
  1111	// --- Structured Extraction API ---
  1112	
  1113	export async function listExtractionTemplates(): Promise<ExtractionTemplate[]> {
  1114	  const res = await fetch(`${PROXY_BASE}/api/extraction-templates`);
  1115	  return handle(res);
  1116	}
  1117	
  1118	export async function listDocumentExtractions(documentId: string): Promise<ExtractionJob[]> {
  1119	  const res = await fetch(`${PROXY_BASE}/api/documents/${documentId}/extractions`);
  1120	  return handle(res);
  1121	}
  1122	
  1123	export async function createExtraction(params: {
  1124	  documentId: string;
  1125	  templateKey: string;
  1126	  locale?: string;
  1127	  domainMode?: 'legal' | 'academic' | null;
  1128	}): Promise<ExtractionJob> {
  1129	  const res = await fetch(`${PROXY_BASE}/api/documents/${params.documentId}/extractions`, {
  1130	    method: 'POST',
  1131	    headers: { 'Content-Type': 'application/json' },
  1132	    body: JSON.stringify({
  1133	      template_key: params.templateKey,
  1134	      locale: params.locale,
  1135	      domain_mode: params.domainMode || null,
  1136	    }),
  1137	  });
  1138	  return handle(res);
  1139	}
  1140	
  1141	export async function getExtraction(jobId: string): Promise<ExtractionJob> {
  1142	  const res = await fetch(`${PROXY_BASE}/api/extractions/${jobId}`);
  1143	  return handle(res);
  1144	}
  1145	
  1146	export async function exportExtraction(jobId: string, format: 'md' | 'csv'): Promise<Blob> {
  1147	  const res = await fetch(`${PROXY_BASE}/api/extractions/${jobId}/export?format=${format}`);
  1148	  if (!res.ok) await throwApiError(res);
  1149	  return res.blob();
  1150	}
  1151	
  1152	// --- Table Extraction API ---
  1153	
  1154	export async function scanDocumentTables(documentId: string): Promise<ExtractionJob> {
  1155	  const res = await fetch(`${PROXY_BASE}/api/documents/${documentId}/tables/scan`, { method: 'POST' });
  1156	  return handle(res);
  1157	}
  1158	
  1159	export async function listDocumentTables(documentId: string): Promise<DocumentTable[]> {
  1160	  const res = await fetch(`${PROXY_BASE}/api/documents/${documentId}/tables`);
  1161	  return handle(res);
  1162	}
  1163	
  1164	export async function getTableScanJob(jobId: string): Promise<ExtractionJob> {
  1165	  const res = await fetch(`${PROXY_BASE}/api/document-table-scans/${jobId}`);
    70	}
    71	
    72	function asString(value: unknown): string {
    73	  return typeof value === "string" ? value : value == null ? "" : String(value);
    74	}
    75	
    76	function refs(value: unknown): number[] {
    77	  if (!Array.isArray(value)) return [];
    78	  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
    79	}
    80	
    81	function downloadBlob(blob: Blob, filename: string) {
    82	  const url = URL.createObjectURL(blob);
    83	  const a = document.createElement("a");
    84	  a.href = url;
    85	  a.download = filename;
    86	  document.body.appendChild(a);
    87	  a.click();
    88	  document.body.removeChild(a);
    89	  URL.revokeObjectURL(url);
    90	}
    91	
    92	export default function ExtractionPanel({ documentId, onCitationClick, userPlan }: ExtractionPanelProps) {
    93	  const { tOr, locale } = useLocale();
    94	  const domainMode = useDocTalkStore((s) => s.domainMode);
    95	  const [activeView, setActiveView] = useState<"deliverables" | "tables" | "templates">("deliverables");
    96	  const [templates, setTemplates] = useState<ExtractionTemplate[]>([]);
    97	  const [jobs, setJobs] = useState<ExtractionJob[]>([]);
    98	  const [tables, setTables] = useState<DocumentTable[]>([]);
    99	  const [tableJob, setTableJob] = useState<ExtractionJob | null>(null);
   100	  const [selectedTemplate, setSelectedTemplate] = useState("executive_summary");
   101	  const [loading, setLoading] = useState(true);
   102	  const [tableLoading, setTableLoading] = useState(true);
   103	  const [tableScanning, setTableScanning] = useState(false);
   104	  const [tableRebuildingId, setTableRebuildingId] = useState<string | null>(null);
   105	  const [running, setRunning] = useState(false);
   106	  const [error, setError] = useState<string | null>(null);
   107	  const [tableError, setTableError] = useState<string | null>(null);
   108	  const [paywallCode, setPaywallCode] = useState<string | null>(null);
   109	  const [tablePaywallCode, setTablePaywallCode] = useState<string | null>(null);
   110	
   111	  const refreshJobs = useCallback(async () => {
   112	    const data = await listDocumentExtractions(documentId);
   113	    setJobs(data);
   114	    return data;
   115	  }, [documentId]);
   116	
   117	  const refreshTables = useCallback(async () => {
   118	    const data = await listDocumentTables(documentId);
   119	    setTables(data);
   120	    return data;
   121	  }, [documentId]);
   122	
   123	  useEffect(() => {
   124	    let cancelled = false;
   125	    setLoading(true);
   126	    Promise.all([listExtractionTemplates(), listDocumentExtractions(documentId)])
   127	      .then(([templateData, jobData]) => {
   128	        if (cancelled) return;
   129	        setTemplates(templateData);
   130	        setJobs(jobData);
   131	        if (templateData[0] && !templateData.some((item) => item.key === selectedTemplate)) {
   132	          setSelectedTemplate(templateData[0].key);
   133	        }
   134	        setLoading(false);
   135	      })
   136	      .catch((err) => {
   137	        if (!cancelled) {
   138	          setError(err instanceof Error ? err.message : "Failed to load extractions");
   139	          setLoading(false);
   140	        }
   141	      });
   142	    return () => {
   143	      cancelled = true;
   144	    };
   145	  }, [documentId, selectedTemplate]);
   146	
   147	  useEffect(() => {
   148	    let cancelled = false;
   149	    setTableLoading(true);
   150	    refreshTables()
   151	      .then(() => {
   152	        if (!cancelled) setTableLoading(false);
   153	      })
   154	      .catch((err) => {
   155	        if (!cancelled) {
   156	          setTableError(err instanceof Error ? err.message : "Failed to load tables");
   157	          setTableLoading(false);
   158	        }
   159	      });
   160	    return () => {
   161	      cancelled = true;
   162	    };
   163	  }, [refreshTables]);
   164	
   165	  useEffect(() => {
   166	    if (!jobs.some((job) => job.status === "queued" || job.status === "running")) return;
   167	    const timer = window.setInterval(() => {
   168	      void refreshJobs().catch(() => undefined);
   169	    }, 2500);
   170	    return () => window.clearInterval(timer);
   171	  }, [jobs, refreshJobs]);
   172	
   173	  useEffect(() => {
   174	    if (!tableJob || (tableJob.status !== "queued" && tableJob.status !== "running")) return;
   175	    const timer = window.setInterval(() => {
   176	      void getTableScanJob(tableJob.id)
   177	        .then((job) => {
   178	          setTableJob(job);
   179	          if (job.status === "succeeded") {
   180	            void refreshTables().catch(() => undefined);
   181	          }
   182	        })
   183	        .catch(() => undefined);
   184	    }, 2500);
   185	    return () => window.clearInterval(timer);
   186	  }, [refreshTables, tableJob]);
   187	
   188	  const activeJob = useMemo(() => jobs[0] || null, [jobs]);
   189	  const selectedTemplateInfo = templates.find((item) => item.key === selectedTemplate);
   190	
   191	  const runExtraction = useCallback(async () => {
   192	    if (running) return;
   193	    setRunning(true);
   194	    setError(null);
   195	    setPaywallCode(null);
   196	    try {
   197	      const job = await createExtraction({
   198	        documentId,
   199	        templateKey: selectedTemplate,
   200	        locale,
   201	        domainMode: domainMode === "legal" || domainMode === "academic" ? domainMode : null,
   202	      });
   203	      setJobs((prev) => [job, ...prev.filter((item) => item.id !== job.id)]);
   204	      trackEvent("extraction_created", {
   205	        source: "extraction_panel",
   206	        reason: selectedTemplate,
   207	        plan: userPlan,
   208	      });
   209	      window.setTimeout(() => {
   210	        void refreshJobs().catch(() => undefined);
   211	      }, 1200);
   212	    } catch (err) {
   213	      if (err instanceof ApiError && (err.code === "INSUFFICIENT_CREDITS" || err.code === "EXTRACTION_LIMIT_REACHED" || err.code === "DOMAIN_MODE_REQUIRES_PLUS")) {
   214	        setPaywallCode(err.code);
   215	      } else {
   216	        setError(err instanceof Error ? err.message : "Extraction failed");
   217	      }
   218	    } finally {
   219	      setRunning(false);
   220	    }
   221	  }, [documentId, domainMode, locale, refreshJobs, running, selectedTemplate, userPlan]);
   222	
   223	  const handleExport = useCallback(async (job: ExtractionJob, format: "md" | "csv") => {
   224	    try {
   225	      const blob = await exportExtraction(job.id, format);
   226	      downloadBlob(blob, `extraction-${job.id.slice(0, 8)}.${format}`);
   227	      trackEvent("extraction_export_clicked", {
   228	        source: "extraction_panel",
   229	        reason: format,
   230	        plan: userPlan,
   231	      });
   232	    } catch (err) {
   233	      setError(err instanceof Error ? err.message : "Export failed");
   234	    }
   235	  }, [userPlan]);
   236	
   237	  const handleScanTables = useCallback(async () => {
   238	    if (tableScanning) return;
   239	    setTableScanning(true);
   240	    setTableError(null);
   430	                  return (
   431	                    <button
   432	                      key={template.key}
   433	                      type="button"
   434	                      onClick={() => setSelectedTemplate(template.key)}
   435	                      className={`min-h-24 rounded-lg border p-3 text-left transition-colors ${
   436	                        active
   437	                          ? "border-[var(--reader-evidence)] bg-[var(--reader-evidence-soft)]"
   438	                          : "border-[var(--reader-border)] bg-[var(--reader-panel-solid)] hover:bg-[var(--reader-panel-muted)]"
   439	                      }`}
   440	                    >
   441	                      <div className="flex items-center gap-2">
   442	                        <Icon size={15} className="text-[var(--reader-evidence)]" aria-hidden="true" />
   443	                        <span className="text-sm font-semibold text-[var(--reader-ink)]">{template.title}</span>
   444	                      </div>
   445	                      <p className="mt-2 text-xs leading-5 text-[var(--reader-muted)]">{template.description}</p>
   446	                    </button>
   447	                  );
   448	                })}
   449	              </div>
   450	              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
   451	                <p className="text-xs text-[var(--reader-muted)]">
   452	                  {selectedTemplateInfo?.description || tOr("extract.chooseTemplate", "Choose an extraction template.")}
   453	                </p>
   454	                <button
   455	                  type="button"
   456	                  onClick={() => void runExtraction()}
   457	                  disabled={running || jobs.some((job) => job.status === "queued" || job.status === "running")}
   458	                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
   459	                >
   460	                  <Play size={14} aria-hidden="true" />
   461	                  {running ? tOr("extract.starting", "Starting...") : tOr("extract.run", "Run extraction")}
   462	                </button>
   463	              </div>
   464	              {paywallCode && (
   465	                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
   466	                  <p className="font-medium">
   467	                    {paywallCode === "EXTRACTION_LIMIT_REACHED"
   468	                      ? tOr("extract.limitReached", "Free extraction limit reached.")
   469	                      : paywallCode === "DOMAIN_MODE_REQUIRES_PLUS"
   470	                      ? tOr("extract.domainModeRequiresPlus", "Legal/Academic domain mode requires the Plus plan.")
   471	                      : tOr("credits.insufficientCredits", "Insufficient Credits")}
   472	                  </p>
   473	                  <Link
   474	                    href={billingHref({ plan: "plus", source: "extraction_panel", reason: paywallCode.toLowerCase() })}
   475	                    className="mt-2 inline-flex text-sm font-medium underline"
   476	                  >
   477	                    {tOr("credits.upgradeToPlus", "Upgrade to Plus")}
   478	                  </Link>
   479	                </div>
   480	              )}
   481	              {error && (
   482	                <div className="mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
   483	                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
   484	                  <span>{error}</span>
   485	                </div>
   486	              )}
   487	            </section>
   488	
   489	            {activeJob && (
   490	              <section className="rounded-lg border border-[var(--reader-border)] bg-white/80 p-4 shadow-sm dark:bg-zinc-900/50">
   491	                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
   492	                  <div className="flex items-center gap-2">
   493	                    {activeJob.status === "succeeded" ? (
   494	                      <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />
   495	                    ) : activeJob.status === "failed" ? (
   496	                      <AlertTriangle size={16} className="text-red-600" aria-hidden="true" />
   497	                    ) : (
   498	                      <Clock3 size={16} className="text-amber-600" aria-hidden="true" />
   499	                    )}
   500	                    <div>
   501	                      <h3 className="text-sm font-semibold text-[var(--reader-ink)]">
   502	                        {templates.find((item) => item.key === activeJob.input_scope?.template_key)?.title || tOr("extract.result", "Extraction result")}
   503	                      </h3>
   504	                      <p className="text-xs text-[var(--reader-muted)]">
   505	                        {activeJob.status === "succeeded"
   506	                          ? tOr("extract.status.succeeded", "Ready")
   507	                          : activeJob.status === "failed"
   508	                            ? tOr("extract.status.failed", "Failed")
   509	                            : tOr("extract.status.running", "Working...")}
   510	                      </p>
   380	    title: tOr('errors.SHARE_NOT_FOUND.title', 'Share not found'),
   381	    body: tOr('errors.SHARE_NOT_FOUND.body', 'This share link is invalid or has been revoked.'),
   382	    severity: 'error',
   383	  }),
   384	
   385	  // ─── Chunks / users ───
   386	  CHUNK_NOT_FOUND: (_d, tOr) => ({
   387	    title: tOr('errors.CHUNK_NOT_FOUND.title', 'Passage not found'),
   388	    body: tOr('errors.CHUNK_NOT_FOUND.body', 'The requested passage no longer exists.'),
   389	    severity: 'error',
   390	  }),
   391	  STRIPE_UNAVAILABLE: (_d, tOr) => ({
   392	    title: tOr('errors.STRIPE_UNAVAILABLE.title', 'Billing unavailable'),
   393	    body: tOr('errors.STRIPE_UNAVAILABLE.body', 'Billing is temporarily unavailable. Please try again shortly.'),
   394	    severity: 'error',
   395	  }),
   396	
   397	  // ─── SSE-only codes (already-structured from Phase 1) ───
   398	  CHAT_SETUP_ERROR: (_d, tOr) => ({
   399	    title: tOr('errors.CHAT_SETUP_ERROR.title', 'Chat setup failed'),
   400	    body: tOr('errors.CHAT_SETUP_ERROR.body', 'Couldn\'t start the chat. Please try again.'),
   401	    severity: 'error',
   402	  }),
   403	  RETRIEVAL_ERROR: (_d, tOr) => ({
   404	    title: tOr('errors.RETRIEVAL_ERROR.title', 'Retrieval failed'),
   405	    body: tOr('errors.RETRIEVAL_ERROR.body', 'Document search failed. Please try again.'),
   406	    severity: 'error',
   407	  }),
   408	  LLM_ERROR: (_d, tOr) => ({
   409	    title: tOr('errors.LLM_ERROR.title', 'Response failed'),
   410	    body: tOr('errors.LLM_ERROR.body', 'The AI provider is temporarily unavailable. Please try again shortly.'),
   411	    severity: 'error',
   412	  }),
   413	  ACCOUNTING_ERROR: (_d, tOr) => ({
   414	    title: tOr('errors.ACCOUNTING_ERROR.title', 'Accounting issue'),
   415	    body: tOr('errors.ACCOUNTING_ERROR.body', 'An internal credit-accounting issue occurred. Your credits are safe.'),
   416	    severity: 'warning',
   417	  }),
   418	  PERSIST_FAILED: (_d, tOr) => ({
   419	    title: tOr('errors.PERSIST_FAILED.title', 'Save failed'),
   420	    body: tOr('errors.PERSIST_FAILED.body', 'Couldn\'t save the response. Please try again.'),
   421	    severity: 'error',
   422	  }),
   423	
   424	  // ─── Server / generic ───
   425	  SERVER_ERROR: (_d, tOr) => ({
   426	    title: tOr('errors.SERVER_ERROR.title', 'Server error'),
   427	    body: tOr('errors.SERVER_ERROR.body', 'An internal error occurred. We\'ve logged it.'),
   428	    severity: 'error',
   429	  }),
   430	};
   431	
   432	// Fallback by status when no recognized code is present (network-layer,
   433	// third-party proxy 502, etc.).
   434	const STATUS_TABLE: Record<number, Handler> = {
   435	  401: (_d, tOr) => ({
   436	    title: tOr('errors.status.401.title', 'Sign in required'),
   437	    body: tOr('errors.status.401.body', 'Please sign in to continue.'),
   438	    cta: { label: tOr('errors.cta.signin', 'Sign in'), href: '/auth' },
   439	    severity: 'info',
   440	  }),
   441	  403: (_d, tOr) => ({
   442	    title: tOr('errors.status.403.title', 'Not allowed'),
   443	    body: tOr('errors.status.403.body', 'You don\'t have access to this.'),
   444	    severity: 'error',
   445	  }),
   446	  404: (_d, tOr) => ({
   447	    title: tOr('errors.status.404.title', 'Not found'),
   448	    body: tOr('errors.status.404.body', 'The item you\'re looking for doesn\'t exist.'),
   449	    severity: 'error',
   450	  }),
   451	  429: (_d, tOr) => ({
   452	    title: tOr('errors.status.429.title', 'Too many requests'),
   453	    body: tOr('errors.status.429.body', 'Please slow down and try again in a moment.'),
   454	    severity: 'warning',
   455	  }),
   456	  502: (_d, tOr) => ({
   457	    title: tOr('errors.status.502.title', 'Service unavailable'),
   458	    body: tOr('errors.status.502.body', 'A dependency is temporarily unavailable. Please try again.'),
   459	    severity: 'error',
   460	  }),
   461	  503: (_d, tOr) => ({
   462	    title: tOr('errors.status.503.title', 'Service unavailable'),
   463	    body: tOr('errors.status.503.body', 'The service is temporarily unavailable.'),
   464	    severity: 'error',
   465	  }),
   466	};
   467	
   468	// ────────────────────────────────────────────────────────────────────
   469	// Worker-error bridge helper: parses `doc.error_msg` returned by
   470	// /api/documents/{id}. Phase 2 writes "ERR_CODE:<CODE>:<text>" but
   471	// legacy rows may still be free text.
   472	// ────────────────────────────────────────────────────────────────────
   473	
   474	export function parseWorkerErrorMsg(raw: string | null | undefined): { code: string | null; fallback: string } {
   475	  if (!raw) return { code: null, fallback: '' };
   476	  const match = raw.match(/^ERR_CODE:([A-Z_][A-Z0-9_]*):(.*)$/s);
   477	  if (match) return { code: match[1], fallback: match[2] };
   478	  return { code: null, fallback: raw };
   479	}
frontend/src/lib/errorCopy.ts:104:  DOCUMENT_LIMIT_REACHED: (d, tOr) => ({
frontend/src/lib/errorCopy.ts:105:    title: tOr('errors.DOCUMENT_LIMIT_REACHED.title', 'Document limit reached'),
frontend/src/lib/errorCopy.ts:106:    body: tOr('errors.DOCUMENT_LIMIT_REACHED.body', 'You\'ve reached your plan\'s document limit ({limit}). Delete an old document or upgrade for more.', {
frontend/src/lib/errorCopy.ts:366:  SHARE_LIMIT_REACHED: (d, tOr) => ({
frontend/src/lib/errorCopy.ts:367:    title: tOr('errors.SHARE_LIMIT_REACHED.title', 'Share limit reached'),
frontend/src/lib/errorCopy.ts:368:    body: tOr('errors.SHARE_LIMIT_REACHED.body', 'Free plan is limited to {limit} active share links. Upgrade for unlimited.', {

exec
/bin/zsh -lc "nl -ba backend/app/core/model_profiles.py | sed -n '65,125p'
for f in frontend/src/i18n/locales/{en,zh,ja,ko,es,de,fr,pt,it,ar,hi}.json; do echo \""'$f"; jq -r '"'[.\"errors.DOMAIN_MODE_REQUIRES_PLUS.title\", .\"errors.DOMAIN_MODE_REQUIRES_PLUS.body\", .\"extract.domainModeRequiresPlus\", .\"paywall.domainMode.title\", .\"paywall.domainMode.body\", .\"paywall.domainMode.cta\"] | @tsv' \""'$f"; done
rg -n '"'SHARE_LIMIT_REACHED' frontend/src/lib/errorCopy.ts backend/app
nl -ba frontend/src/lib/errorCopy.ts | sed -n '350,380p'
rg -n 'DOCUMENT_LIMIT_REACHED' backend/app/api backend/app/services | head -n 80
rg -n 'layoutTranslationError|setLayoutTranslationError|layoutPaywall' 'frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx'
rg -n 'layoutImportError|setLayoutImportError|autoImport' frontend/src/components/Chat/ChatArtifactCard.tsx" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
    65	    ),
    66	}
    67	
    68	# Collection-session variants add a "mention which document" rule.
    69	COLLECTION_EXTRA_RULES: dict[str, str] = {
    70	    "default": (
    71	        "4b. When relevant, mention which document the information comes from.\n"
    72	    ),
    73	    "positive_framing": (
    74	        "4b. When relevant, mention which document the information comes from.\n"
    75	    ),
    76	}
    77	
    78	# ---------------------------------------------------------------------------
    79	# Domain-specific rules (legal/academic mode overlay)
    80	# ---------------------------------------------------------------------------
    81	DOMAIN_RULES: dict[str, list[str]] = {
    82	    "legal": [
    83	        "Every factual claim MUST have a citation [n] to a specific document source. "
    84	        "If the document does not contain relevant information, state: "
    85	        "'The document does not contain information on this topic.'",
    86	        "Never generate, infer, or paraphrase legal conclusions not directly supported by the document text.",
    87	        "Use precise legal language: 'The document states...' rather than 'According to...' or 'It seems...'",
    88	        "When quoting, preserve the original wording exactly. Mark any omissions with [...].",
    89	        "If multiple interpretations are possible, present each with its supporting citation.",
    90	    ],
    91	    "academic": [
    92	        "Every claim MUST cite the specific document source with [n]. "
    93	        "Clearly distinguish direct quotes from paraphrased content.",
    94	        "For comparative questions, cite multiple sources and note agreements or contradictions between them.",
    95	        "Include section titles and page numbers in your analysis when referencing specific parts of a document.",
    96	        "Use academic register: hedging language for uncertain claims ('the data suggests...'), "
    97	        "definitive language only for directly quoted content.",
    98	        "If the documents do not contain sufficient evidence to answer, "
    99	        "explicitly state the limitation rather than speculating.",
   100	    ],
   101	}
   102	
   103	
   104	# ---------------------------------------------------------------------------
   105	# Model registry
   106	# ---------------------------------------------------------------------------
   107	
   108	MODEL_PROFILES: dict[str, ModelProfile] = {
   109	    "deepseek-v4-flash": ModelProfile(
   110	        temperature=0.1,
   111	        max_tokens=3072,
   112	        supports_cache_control=False,
   113	        supports_stream_options=True,
   114	        prompt_style="positive_framing",
   115	    ),
   116	    "deepseek-v4-pro": ModelProfile(
   117	        temperature=0.1,
   118	        max_tokens=4096,
   119	        supports_cache_control=False,
   120	        supports_stream_options=True,
   121	        prompt_style="positive_framing",
   122	    ),
   123	    "deepseek/deepseek-v3.2": ModelProfile(
   124	        temperature=0.1,
   125	        max_tokens=2048,
frontend/src/i18n/locales/en.json
Plus plan required	Legal and Academic domain mode is available on the Plus plan.	Legal/Academic domain mode requires the Plus plan.	Unlock Legal & Academic mode	Legal and Academic domain mode is available on the Plus plan, tuning citations and prompts for domain-specific reading.	Upgrade for domain mode
frontend/src/i18n/locales/zh.json
需要Plus套餐	法律和学术领域模式仅在Plus套餐中可用。	法律/学术领域模式需要Plus套餐。	解锁法律与学术模式	法律和学术领域模式在Plus套餐中可用，为特定领域的阅读优化引用和提示词。	升级以使用领域模式
frontend/src/i18n/locales/ja.json
Plusプランが必要です	法律・学術ドメインモードはPlusプランで利用できます。	法律/学術ドメインモードにはPlusプランが必要です。	法律＆学術モードを解放	法律・学術ドメインモードはPlusプランで利用でき、分野に特化した読解のために引用とプロンプトを調整します。	ドメインモードにアップグレード
frontend/src/i18n/locales/ko.json
Plus 요금제 필요	법률 및 학술 도메인 모드는 Plus 요금제에서 사용할 수 있습니다.	법률/학술 도메인 모드는 Plus 요금제가 필요합니다.	법률 및 학술 모드 잠금 해제	법률 및 학술 도메인 모드는 Plus 요금제에서 사용할 수 있으며, 분야별 읽기에 맞춰 인용과 프롬프트를 조정합니다.	도메인 모드로 업그레이드
frontend/src/i18n/locales/es.json
Plan Plus requerido	El modo de dominio Legal y Académico está disponible en el plan Plus.	El modo de dominio Legal/Académico requiere el plan Plus.	Desbloquea el modo Legal y Académico	El modo de dominio Legal y Académico está disponible en el plan Plus, ajustando citas y prompts para una lectura específica del dominio.	Actualizar para el modo de dominio
frontend/src/i18n/locales/de.json
Plus-Tarif erforderlich	Der Rechts- und Wissenschaftsmodus ist im Plus-Tarif verfügbar.	Der Rechts-/Wissenschaftsmodus erfordert den Plus-Tarif.	Rechts- & Wissenschaftsmodus freischalten	Der Rechts- und Wissenschaftsmodus ist im Plus-Tarif verfügbar und passt Zitate und Prompts für fachspezifisches Lesen an.	Upgrade für Domänenmodus
frontend/src/i18n/locales/fr.json
Forfait Plus requis	Le mode de domaine Juridique et Académique est disponible avec le forfait Plus.	Le mode de domaine Juridique/Académique nécessite le forfait Plus.	Débloquer le mode Juridique et Académique	Le mode de domaine Juridique et Académique est disponible avec le forfait Plus, ajustant les citations et les prompts pour une lecture spécifique au domaine.	Passer à Plus pour le mode de domaine
frontend/src/i18n/locales/pt.json
Plano Plus necessário	O modo de domínio Jurídico e Acadêmico está disponível no plano Plus.	O modo de domínio Jurídico/Acadêmico requer o plano Plus.	Desbloqueie o modo Jurídico e Acadêmico	O modo de domínio Jurídico e Acadêmico está disponível no plano Plus, ajustando citações e prompts para leitura específica do domínio.	Atualizar para o modo de domínio
frontend/src/i18n/locales/it.json
Piano Plus richiesto	La modalità dominio Legale e Accademico è disponibile nel piano Plus.	La modalità dominio Legale/Accademico richiede il piano Plus.	Sblocca la modalità Legale e Accademico	La modalità dominio Legale e Accademico è disponibile nel piano Plus, adattando citazioni e prompt per una lettura specifica del dominio.	Passa a Plus per la modalità dominio
frontend/src/i18n/locales/ar.json
مطلوب خطة Plus	وضع المجال القانوني والأكاديمي متاح في خطة Plus.	يتطلب وضع المجال القانوني/الأكاديمي خطة Plus.	افتح وضع القانوني والأكاديمي	وضع المجال القانوني والأكاديمي متاح في خطة Plus، ويضبط الاستشهادات والمطالبات للقراءة الخاصة بالمجال.	الترقية لوضع المجال
frontend/src/i18n/locales/hi.json
Plus योजना आवश्यक	कानूनी और शैक्षणिक डोमेन मोड Plus योजना पर उपलब्ध है।	कानूनी/शैक्षणिक डोमेन मोड के लिए Plus योजना आवश्यक है।	कानूनी और शैक्षणिक मोड अनलॉक करें	कानूनी और शैक्षणिक डोमेन मोड Plus योजना पर उपलब्ध है, जो डोमेन-विशिष्ट पठन के लिए उद्धरण और प्रॉम्प्ट को समायोजित करता है।	डोमेन मोड के लिए अपग्रेड करें
frontend/src/lib/errorCopy.ts:366:  SHARE_LIMIT_REACHED: (d, tOr) => ({
frontend/src/lib/errorCopy.ts:367:    title: tOr('errors.SHARE_LIMIT_REACHED.title', 'Share limit reached'),
frontend/src/lib/errorCopy.ts:368:    body: tOr('errors.SHARE_LIMIT_REACHED.body', 'Free plan is limited to {limit} active share links. Upgrade for unlimited.', {
backend/app/api/sharing.py:84:                    "error": "SHARE_LIMIT_REACHED",
   350	  LAYOUT_TRANSLATION_FILE_TOO_LARGE: (d, tOr) => ({
   351	    title: tOr('errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.title', 'PDF too large for layout translation'),
   352	    body: tOr(
   353	      'errors.LAYOUT_TRANSLATION_FILE_TOO_LARGE.body',
   354	      'Layout-preserving PDF translation supports files up to {maxMb} MB.',
   355	      { maxMb: String(d.max_mb ?? '') },
   356	    ),
   357	    severity: 'warning',
   358	  }),
   359	  LAYOUT_TRANSLATION_NOT_CONFIGURED: (_d, tOr) => ({
   360	    title: tOr('errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.title', 'PDF translation is being set up'),
   361	    body: tOr('errors.LAYOUT_TRANSLATION_NOT_CONFIGURED.body', 'Layout-preserving PDF translation is temporarily unavailable while the service is being configured.'),
   362	    severity: 'info',
   363	  }),
   364	
   365	  // ─── Sharing ───
   366	  SHARE_LIMIT_REACHED: (d, tOr) => ({
   367	    title: tOr('errors.SHARE_LIMIT_REACHED.title', 'Share limit reached'),
   368	    body: tOr('errors.SHARE_LIMIT_REACHED.body', 'Free plan is limited to {limit} active share links. Upgrade for unlimited.', {
   369	      limit: String(d.limit ?? 3),
   370	    }),
   371	    cta: upgradeCta(tOr, 'share_limit', 'plus'),
   372	    severity: 'warning',
   373	  }),
   374	  SHARE_EXPIRED: (_d, tOr) => ({
   375	    title: tOr('errors.SHARE_EXPIRED.title', 'Share expired'),
   376	    body: tOr('errors.SHARE_EXPIRED.body', 'This share link has expired.'),
   377	    severity: 'info',
   378	  }),
   379	  SHARE_NOT_FOUND: (_d, tOr) => ({
   380	    title: tOr('errors.SHARE_NOT_FOUND.title', 'Share not found'),
backend/app/api/layout_translations.py:176:                "error": "DOCUMENT_LIMIT_REACHED",
backend/app/api/documents.py:227:                "error": "DOCUMENT_LIMIT_REACHED",
backend/app/api/documents.py:361:                "error": "DOCUMENT_LIMIT_REACHED",
60:  const [layoutTranslationError, setLayoutTranslationError] = useState<ErrorCopy | null>(null);
61:  const [layoutPaywallOpen, setLayoutPaywallOpen] = useState(false);
62:  const [layoutPaywallReason, setLayoutPaywallReason] = useState<string | null>(null);
153:    setLayoutTranslationError(null);
164:    setLayoutTranslationError(null);
205:        setLayoutTranslationError(errorCopy(err, t, tOr));
296:      {layoutTranslationError ? (
300:            <span className="font-medium">{layoutTranslationError.title}: </span>
301:            {layoutTranslationError.body}
302:            {layoutTranslationError.cta && (
305:                onClick={() => router.push(layoutTranslationError.cta!.href)}
308:                {layoutTranslationError.cta.label}
314:            onClick={() => setLayoutTranslationError(null)}
583:        isOpen={layoutPaywallOpen}
585:        reason={layoutPaywallReason}
109:  const [layoutImportError, setLayoutImportError] = useState<ErrorCopy | null>(null);
110:  const autoImportAttemptedRef = useRef(false);
283:    setLayoutImportError(null);
297:      setLayoutImportError(errorCopy(err, t, tOr));
304:    if (!isLayoutTranslation || !isDone || !importRequested || importedDocumentId || autoImportAttemptedRef.current) return;
305:    autoImportAttemptedRef.current = true;
334:          {layoutImportError ? (
336:              {layoutImportError.title}: {layoutImportError.body}
337:              {layoutImportError.cta && (
339:                  href={layoutImportError.cta.href}
342:                  {layoutImportError.cta.label}

exec
/bin/zsh -lc "nl -ba backend/app/services/extraction_service.py | sed -n '513,700p'
nl -ba backend/app/api/extractions.py | sed -n '289,470p'
rg -n --glob '*.py' 'DocumentJob\\(' backend/app | sort
rg -n --glob '*.py' 'input_scope.*domain|domain_mode.*input_scope|run_extraction_job_sync|run_extraction_job\\.delay' backend/app backend/tests | sort
rg -n --glob '*.py' 'ChatSession\\(' backend/app | sort
rg -n --glob '*.py' 'session_obj\\.domain_mode|session\\.domain_mode|ChatSession\\.domain_mode' backend/app | sort" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   513	def run_extraction_job_sync(job_id: str) -> None:
   514	    from app.models.sync_database import SyncSessionLocal
   515	
   516	    job_uuid = uuid.UUID(job_id)
   517	    with SyncSessionLocal() as db:
   518	        job = db.get(DocumentJob, job_uuid)
   519	        if not job:
   520	            logger.warning("Extraction job %s not found", job_id)
   521	            return
   522	        if job.status not in ("queued", "running"):
   523	            return
   524	
   525	        job.status = "running"
   526	        job.updated_at = datetime.now(timezone.utc)
   527	        db.add(job)
   528	        db.commit()
   529	
   530	        pre_debited = int((job.metadata_json or {}).get("pre_debited") or 0)
   531	        ledger_raw = (job.metadata_json or {}).get("predebit_ledger_id")
   532	        ledger_id = uuid.UUID(str(ledger_raw)) if ledger_raw else None
   533	
   534	        try:
   535	            doc = db.get(Document, job.document_id) if job.document_id else None
   536	            if not doc or doc.status != "ready":
   537	                raise ValueError("DOCUMENT_NOT_READY")
   538	            template_key = str((job.input_scope or {}).get("template_key") or "")
   539	            template = get_template(template_key)
   540	            locale = (job.input_scope or {}).get("locale")
   541	            domain_mode = (job.input_scope or {}).get("domain_mode")
   542	            chunks = retrieve_extraction_chunks(db, doc.id, template)
   543	            if not chunks:
   544	                raise ValueError("NO_RETRIEVABLE_CHUNKS")
   545	
   546	            raw, prompt_tokens, completion_tokens = _call_llm(template, chunks, locale, domain_mode)
   547	            structured = normalize_result(template.key, raw, len(chunks))
   548	            rendered = render_markdown(template, structured)
   549	            refs = sorted({ref for ref in _walk_refs(structured) if 1 <= ref <= len(chunks)})
   550	            citations = [
   551	                _citation_from_chunk(ref, chunks[ref - 1][0], chunks[ref - 1][1])
   552	                for ref in refs
   553	            ]
   554	            actual_cost = calculate_cost(prompt_tokens, completion_tokens, EXTRACTION_MODEL, mode=EXTRACTION_MODE)
   555	            if ledger_id and pre_debited > 0:
   556	                _reconcile_sync(db, job.user_id, ledger_id, pre_debited, actual_cost)
   557	            db.add(
   558	                UsageRecord(
   559	                    user_id=job.user_id,
   560	                    message_id=None,
   561	                    model=EXTRACTION_MODEL,
   562	                    prompt_tokens=prompt_tokens,
   563	                    completion_tokens=completion_tokens,
   564	                    total_tokens=prompt_tokens + completion_tokens,
   565	                    cost_credits=actual_cost,
   566	                )
   567	            )
   568	            job.cost_credits = actual_cost
   569	            job.status = "succeeded"
   570	            job.error_code = None
   571	            job.error_message = None
   572	            job.completed_at = datetime.now(timezone.utc)
   573	            job.updated_at = job.completed_at
   574	            db.add(job)
   575	            db.add(
   576	                ExtractionResult(
   577	                    job_id=job.id,
   578	                    template_key=template.key,
   579	                    structured_json=structured,
   580	                    rendered_markdown=rendered,
   581	                    citations=citations,
   582	                )
   583	            )
   584	            db.commit()
   585	        except Exception as exc:
   586	            db.rollback()
   587	            job = db.get(DocumentJob, job_uuid)
   588	            if not job:
   589	                return
   590	            if ledger_id and pre_debited > 0:
   591	                try:
   592	                    _refund_predebit_sync(db, job.user_id, pre_debited, ledger_id)
   593	                except Exception:
   594	                    logger.exception("Failed to refund extraction job %s", job_id)
   595	            code = str(exc) if str(exc).isupper() else "EXTRACTION_FAILED"
   596	            job.status = "failed"
   597	            job.error_code = code[:64]
   598	            job.error_message = "Structured extraction failed"
   599	            job.completed_at = datetime.now(timezone.utc)
   600	            job.updated_at = job.completed_at
   601	            db.add(job)
   602	            db.commit()
   603	            logger.exception("Extraction job %s failed: %s", job_id, exc)
   289	    return _job_response(job)
   290	
   291	
   292	@router.get("/documents/{document_id}/extractions", response_model=list[ExtractionJobResponse])
   293	async def list_document_extractions(
   294	    document_id: uuid.UUID,
   295	    user: User = Depends(require_auth),
   296	    db: AsyncSession = Depends(get_db_session),
   297	):
   298	    doc = await _verify_document(document_id, user, db)
   299	    rows = await db.execute(
   300	        select(DocumentJob)
   301	        .options(selectinload(DocumentJob.extraction_result))
   302	        .where(DocumentJob.user_id == user.id)
   303	        .where(DocumentJob.document_id == doc.id)
   304	        .where(DocumentJob.job_type == EXTRACTION_JOB_TYPE)
   305	        .order_by(DocumentJob.created_at.desc())
   306	        .limit(20)
   307	    )
   308	    return [_job_response(job) for job in rows.scalars()]
   309	
   310	
   311	@router.get("/extractions/{job_id}", response_model=ExtractionJobResponse)
   312	async def get_extraction(
   313	    job_id: uuid.UUID,
   314	    user: User = Depends(require_auth),
   315	    db: AsyncSession = Depends(get_db_session),
   316	):
   317	    row = await db.execute(
   318	        select(DocumentJob)
   319	        .options(selectinload(DocumentJob.extraction_result))
   320	        .where(DocumentJob.id == job_id)
   321	        .where(DocumentJob.user_id == user.id)
   322	        .where(DocumentJob.job_type == EXTRACTION_JOB_TYPE)
   323	    )
   324	    job = row.scalar_one_or_none()
   325	    if not job:
   326	        raise HTTPException(
   327	            status_code=404,
   328	            detail={"error": "EXTRACTION_NOT_FOUND", "message": "Extraction not found"},
   329	        )
   330	    return _job_response(job)
   331	
   332	
   333	@router.get("/extractions/{job_id}/export")
   334	async def export_extraction(
   335	    job_id: uuid.UUID,
   336	    format: Literal["md", "csv"] = Query("md"),
   337	    user: User = Depends(require_auth),
   338	    db: AsyncSession = Depends(get_db_session),
   339	):
   340	    row = await db.execute(
   341	        select(DocumentJob)
   342	        .options(selectinload(DocumentJob.extraction_result))
   343	        .where(DocumentJob.id == job_id)
   344	        .where(DocumentJob.user_id == user.id)
   345	        .where(DocumentJob.job_type == EXTRACTION_JOB_TYPE)
   346	    )
   347	    job = row.scalar_one_or_none()
   348	    result = _loaded_extraction_result(job) if job else None
   349	    if not job or not result:
   350	        raise HTTPException(
   351	            status_code=404,
   352	            detail={"error": "EXTRACTION_NOT_FOUND", "message": "Extraction not found"},
   353	        )
   354	    stem = f"extraction-{result.template_key}-{str(job.id)[:8]}"
   355	    if format == "csv":
   356	        content = render_csv(result.template_key, result.structured_json or {})
   357	        return StreamingResponse(
   358	            iter([content.encode("utf-8-sig")]),
   359	            media_type="text/csv; charset=utf-8",
   360	            headers={"Content-Disposition": _content_disposition(f"{stem}.csv")},
   361	        )
   362	    content = result.rendered_markdown or ""
   363	    return StreamingResponse(
   364	        iter([content.encode("utf-8")]),
   365	        media_type="text/markdown; charset=utf-8",
   366	        headers={"Content-Disposition": _content_disposition(f"{stem}.md")},
   367	    )
backend/app/api/document_diffs.py:175:    job = DocumentJob(
backend/app/api/extractions.py:216:    job = DocumentJob(
backend/app/api/layout_translations.py:308:    job = DocumentJob(
backend/app/api/question_templates.py:253:    job = DocumentJob(
backend/app/api/tables.py:148:    job = DocumentJob(
backend/app/api/tables.py:229:    job = DocumentJob(
backend/app/models/tables.py:546:class DocumentJob(Base):
backend/app/services/chat_tool_executor.py:142:    job = DocumentJob(
backend/app/services/chat_tool_executor.py:330:        job = DocumentJob(
backend/app/api/extractions.py:271:        run_extraction_job.delay(str(job.id))
backend/app/services/chat_tool_executor.py:202:        run_extraction_job.delay(str(job.id))
backend/app/services/extraction_service.py:513:def run_extraction_job_sync(job_id: str) -> None:
backend/app/services/extraction_service.py:541:            domain_mode = (job.input_scope or {}).get("domain_mode")
backend/app/workers/extraction_worker.py:23:    run_extraction_job_sync(job_id)
backend/app/workers/extraction_worker.py:6:from app.services.extraction_service import run_extraction_job_sync
backend/app/api/chat.py:301:    sess = ChatSession(document_id=document_id, user_id=user.id if user else None)
backend/app/api/collections.py:330:    sess = ChatSession(collection_id=collection_id, user_id=user.id)
backend/app/models/tables.py:197:class ChatSession(Base):
backend/app/api/chat.py:670:            ChatSession.domain_mode,
backend/app/api/chat.py:678:        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
backend/app/api/collections.py:363:            ChatSession.domain_mode,
backend/app/api/collections.py:370:        .group_by(ChatSession.id, ChatSession.title, ChatSession.domain_mode, ChatSession.created_at)
backend/app/services/chat_service.py:2057:            if domain_mode != session_obj.domain_mode:
backend/app/services/chat_service.py:2058:                session_obj.domain_mode = domain_mode

exec
/bin/zsh -lc "nl -ba backend/app/api/layout_translations.py | sed -n '130,205p;270,340p'
nl -ba backend/app/api/sharing.py | sed -n '55,105p'
nl -ba backend/app/api/documents.py | sed -n '200,245p;335,375p'
nl -ba 'frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx' | sed -n '130,225p;270,325p;560,600p'
nl -ba frontend/src/components/Chat/ChatArtifactCard.tsx | sed -n '250,355p'
rg -n --glob '*.{ts,tsx}' 'importLayoutTranslationDocument|submitLayout|startLayout|translateLayout' frontend/src/lib frontend/src/components frontend/src/app" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   130	        select(DocumentJob)
   131	        .where(DocumentJob.user_id == user_id)
   132	        .where(DocumentJob.document_id == document_id)
   133	        .where(DocumentJob.job_type == LAYOUT_TRANSLATION_JOB_TYPE)
   134	        .where(DocumentJob.status.in_(["queued", "running"]))
   135	        .order_by(DocumentJob.created_at.desc())
   136	        .limit(10)
   137	    )
   138	    for job in rows.scalars():
   139	        if (job.input_scope or {}).get("target_language") == target_language:
   140	            return job
   141	    return None
   142	
   143	
   144	async def _free_layout_translation_used(user: User, db: AsyncSession) -> int:
   145	    used = await db.scalar(
   146	        select(func.count())
   147	        .select_from(DocumentJob)
   148	        .where(DocumentJob.user_id == user.id)
   149	        .where(DocumentJob.job_type == LAYOUT_TRANSLATION_JOB_TYPE)
   150	        .where(DocumentJob.status.in_(list(LAYOUT_TRANSLATION_ACTIVE_STATUSES)))
   151	    )
   152	    return int(used or 0)
   153	
   154	
   155	def _max_documents_for_plan(plan: str) -> int:
   156	    return {
   157	        "free": settings.FREE_MAX_DOCUMENTS,
   158	        "plus": settings.PLUS_MAX_DOCUMENTS,
   159	        "pro": settings.PRO_MAX_DOCUMENTS,
   160	    }.get(plan, settings.FREE_MAX_DOCUMENTS)
   161	
   162	
   163	async def _assert_document_capacity(user: User, db: AsyncSession) -> None:
   164	    plan = (user.plan or "free").lower()
   165	    current = await db.scalar(
   166	        select(func.count())
   167	        .select_from(Document)
   168	        .where(Document.user_id == user.id)
   169	        .where(Document.status != "deleting")
   170	    )
   171	    max_docs = _max_documents_for_plan(plan)
   172	    if int(current or 0) >= max_docs:
   173	        raise HTTPException(
   174	            status_code=403,
   175	            detail={
   176	                "error": "DOCUMENT_LIMIT_REACHED",
   177	                "message": "Document limit reached for current plan",
   178	                "limit": max_docs,
   179	                "current": int(current or 0),
   180	                "plan": plan,
   181	            },
   182	        )
   183	
   184	
   185	def _enqueue_layout_translation_job(job_id: str) -> None:
   186	    from app.workers.layout_translation_worker import run_layout_translation_job
   187	
   188	    run_layout_translation_job.delay(job_id)
   189	
   190	
   191	def _raise_layout_translation_limit_error(doc: Document, plan: str) -> None:
   192	    try:
   193	        validate_layout_translation_size_limits(
   194	            plan=plan,
   195	            file_size=doc.file_size,
   196	            page_count=doc.page_count,
   197	        )
   198	    except LayoutTranslationLimitError as exc:
   199	        if exc.code == "LAYOUT_TRANSLATION_FILE_TOO_LARGE":
   200	            max_mb = layout_translation_file_size_limit_mb()
   201	            raise HTTPException(
   202	                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
   203	                detail={
   204	                    "error": "LAYOUT_TRANSLATION_FILE_TOO_LARGE",
   205	                    "message": str(exc),
   270	            await db.commit()
   271	            await db.refresh(existing)
   272	        return await _job_response(existing, db, user)
   273	
   274	    plan = (user.plan or "free").lower()
   275	    _raise_layout_translation_limit_error(doc, plan)
   276	    if body.add_to_library:
   277	        await _assert_document_capacity(user, db)
   278	
   279	    config_status = layout_translation_config_status()
   280	    if not config_status.ready:
   281	        raise HTTPException(
   282	            status_code=503,
   283	            detail={
   284	                "error": "LAYOUT_TRANSLATION_NOT_CONFIGURED",
   285	                "message": "Layout-preserving translation is temporarily unavailable.",
   286	                "missing": list(config_status.missing),
   287	            },
   288	        )
   289	
   290	    free_used = 0
   291	    free_limit = layout_translation_trial_limit()
   292	    if not plan_allows_unlimited_layout_translation(plan):
   293	        free_used = await _free_layout_translation_used(user, db)
   294	        if free_used >= free_limit:
   295	            raise HTTPException(
   296	                status_code=403,
   297	                detail={
   298	                    "error": "LAYOUT_TRANSLATION_LIMIT_REACHED",
   299	                    "message": "Free plan layout-preserving PDF translation limit reached",
   300	                    "limit": free_limit,
   301	                    "used": free_used,
   302	                    "required_plan": LAYOUT_TRANSLATION_REQUIRED_PLAN,
   303	                },
   304	            )
   305	
   306	    engine = str(getattr(config_status, "engine", "retainpdf") or "retainpdf")
   307	    provider = str(getattr(config_status, "ocr_provider", engine) or engine)
   308	    job = DocumentJob(
   309	        id=uuid.uuid4(),
   310	        user_id=user.id,
   311	        document_id=doc.id,
   312	        job_type=LAYOUT_TRANSLATION_JOB_TYPE,
   313	        status="queued",
   314	        input_scope={
   315	            "target_language": target_language,
   316	            "target_language_label": target_language_label(target_language),
   317	            "locale": body.locale,
   318	            "source": "document_reader",
   319	            "source_filename": doc.filename,
   320	            "add_to_library": body.add_to_library,
   321	        },
   322	        cost_credits=0,
   323	        metadata_json={
   324	            "provider": provider,
   325	            "engine": engine,
   326	            "target_language": target_language,
   327	            "target_language_label": target_language_label(target_language),
   328	            "plan": plan,
   329	            "page_count": doc.page_count,
   330	            "max_pages": layout_translation_max_pages_for_plan(plan),
   331	            "max_file_size_mb": layout_translation_file_size_limit_mb(),
   332	            "free_limit": free_limit,
   333	            "free_used_before": free_used,
   334	            "free_remaining_after": None if plan_allows_unlimited_layout_translation(plan) else max(0, free_limit - free_used - 1),
   335	            "required_plan": LAYOUT_TRANSLATION_REQUIRED_PLAN,
   336	            "add_to_library_requested": body.add_to_library,
   337	        },
   338	    )
   339	    db.add(job)
   340	    db.add(
    55	            SharedSession.session_id == session_id,
    56	            SharedSession.user_id == user.id,
    57	        )
    58	    )
    59	    share = existing.scalar_one_or_none()
    60	    if share:
    61	        return ShareResponse(
    62	            share_token=str(share.share_token),
    63	            url=f"{settings.FRONTEND_URL}/shared/{share.share_token}",
    64	            expires_at=share.expires_at.isoformat() if share.expires_at else None,
    65	        )
    66	
    67	    # Free plan limit: 3 active shares
    68	    if user.plan not in ("plus", "pro"):
    69	        count_result = await db.execute(
    70	            select(func.count())
    71	            .select_from(SharedSession)
    72	            .where(
    73	                SharedSession.user_id == user.id,
    74	                (SharedSession.expires_at.is_(None))
    75	                | (SharedSession.expires_at > datetime.now(timezone.utc)),
    76	            )
    77	        )
    78	        active_count = count_result.scalar() or 0
    79	        if active_count >= 3:
    80	            plan = (user.plan or "free").lower()
    81	            raise HTTPException(
    82	                status_code=403,
    83	                detail={
    84	                    "error": "SHARE_LIMIT_REACHED",
    85	                    "message": "Free plan limited to 3 active share links. Upgrade to Plus for unlimited.",
    86	                    "limit": 3,
    87	                    "plan": plan,
    88	                },
    89	            )
    90	
    91	    # Create share
    92	    share = SharedSession(session_id=session_id, user_id=user.id)
    93	    db.add(share)
    94	    await db.commit()
    95	    await db.refresh(share)
    96	
    97	    return ShareResponse(
    98	        share_token=str(share.share_token),
    99	        url=f"{settings.FRONTEND_URL}/shared/{share.share_token}",
   100	    )
   101	
   102	
   103	@router.delete("/api/sessions/{session_id}/share", status_code=204)
   104	async def revoke_share(
   105	    session_id: UUID,
   200	    if file_type is None or file_type not in settings.ALLOWED_FILE_TYPES:
   201	        raise HTTPException(
   202	            status_code=400,
   203	            detail={"error": "UNSUPPORTED_FORMAT", "message": "Unsupported file format"},
   204	        )
   205	
   206	    # Enforce per-plan document count limit
   207	    from sqlalchemy import func
   208	    from sqlalchemy import select as sa_select
   209	
   210	    from app.models.tables import Document
   211	    user_doc_count = await db.scalar(
   212	        sa_select(func.count()).select_from(Document)
   213	        .where(Document.user_id == user.id)
   214	        .where(Document.status != "deleting")
   215	    )
   216	    plan = getattr(user, 'plan', None) or "free"
   217	    max_docs = {
   218	        "free": settings.FREE_MAX_DOCUMENTS,
   219	        "plus": settings.PLUS_MAX_DOCUMENTS,
   220	        "pro": settings.PRO_MAX_DOCUMENTS,
   221	    }.get(plan, settings.FREE_MAX_DOCUMENTS)
   222	    if user_doc_count >= max_docs:
   223	        log_security_event("plan_limit_hit", user_id=user.id, plan=plan, limit_type="documents", limit=max_docs, current=user_doc_count)
   224	        raise HTTPException(
   225	            status_code=403,
   226	            detail={
   227	                "error": "DOCUMENT_LIMIT_REACHED",
   228	                "message": "Document limit reached for current plan",
   229	                "limit": max_docs,
   230	                "current": user_doc_count,
   231	                "plan": plan,
   232	            },
   233	        )
   234	
   235	    # Validate size by streaming bytes with early abort to prevent memory DoS
   236	    max_size_mb = {
   237	        "free": settings.FREE_MAX_FILE_SIZE_MB,
   238	        "plus": settings.PLUS_MAX_FILE_SIZE_MB,
   239	        "pro": settings.PRO_MAX_FILE_SIZE_MB,
   240	    }.get(plan, settings.FREE_MAX_FILE_SIZE_MB)
   241	    max_bytes = max_size_mb * 1024 * 1024
   242	    buf = bytearray()
   243	    while True:
   244	        chunk = await file.read(64 * 1024)
   245	        if not chunk:
   335	                detail={"error": "URL_FETCH_BLOCKED", "message": "This URL can't be imported"},
   336	            )
   337	        logger.exception("Unexpected ValueError in ingest_url validation")
   338	        raise HTTPException(status_code=500, detail=SERVER_ERROR_DETAIL)
   339	
   340	    # Enforce per-plan document count limit
   341	    from sqlalchemy import func
   342	    from sqlalchemy import select as sa_select
   343	
   344	    from app.models.tables import Document
   345	    user_doc_count = await db.scalar(
   346	        sa_select(func.count()).select_from(Document)
   347	        .where(Document.user_id == user.id)
   348	        .where(Document.status != "deleting")
   349	    )
   350	    plan = getattr(user, 'plan', None) or "free"
   351	    max_docs = {
   352	        "free": settings.FREE_MAX_DOCUMENTS,
   353	        "plus": settings.PLUS_MAX_DOCUMENTS,
   354	        "pro": settings.PRO_MAX_DOCUMENTS,
   355	    }.get(plan, settings.FREE_MAX_DOCUMENTS)
   356	    if user_doc_count >= max_docs:
   357	        log_security_event("plan_limit_hit", user_id=user.id, plan=plan, limit_type="documents", limit=max_docs, current=user_doc_count)
   358	        raise HTTPException(
   359	            status_code=403,
   360	            detail={
   361	                "error": "DOCUMENT_LIMIT_REACHED",
   362	                "message": "Document limit reached for current plan",
   363	                "limit": max_docs,
   364	                "current": user_doc_count,
   365	                "plan": plan,
   366	            },
   367	        )
   368	
   369	    try:
   370	        import asyncio
   371	
   372	        from app.services.extractors.url_extractor import fetch_and_extract_url
   373	        title, pages, pdf_bytes = await asyncio.to_thread(fetch_and_extract_url, url)
   374	    except ValueError as e:
   375	        code = str(e)
   130	      });
   131	
   132	    return () => { cancelled = true; };
   133	  }, [searchParams, navigateToCitation, revealMobileDocumentPane]);
   134	
   135	  // Determine which viewer to use:
   136	  // - Native PDF: always PdfViewer with original URL
   137	  // - PPTX/DOCX with converted PDF: PdfViewer (slide view) or TextViewer (text view), with toggle
   138	  // - Other non-PDF: TextViewer only
   139	  const useConvertedPdf = hasConvertedPdf && viewMode === 'slide' && convertedPdfUrl;
   140	  const showViewToggle = hasConvertedPdf && fileType !== 'pdf';
   141	
   142	  useEffect(() => {
   143	    setTranslatedPreview(null);
   144	    setPdfPreviewMode('original');
   145	    setLayoutTranslationDrawerOpen(false);
   146	  }, [documentId]);
   147	
   148	  const handleOpenLayoutTranslation = useCallback(() => {
   149	    if (!isLoggedIn) {
   150	      openAuthModal();
   151	      return;
   152	    }
   153	    setLayoutTranslationError(null);
   154	    setLayoutTranslationDrawerOpen(true);
   155	  }, [isLoggedIn]);
   156	
   157	  const handleLayoutTranslationSubmit = useCallback(async ({ targetLanguage, addToLibrary }: { targetLanguage: string; addToLibrary: boolean }) => {
   158	    if (layoutTranslationBusy) return;
   159	    if (!isLoggedIn) {
   160	      openAuthModal();
   161	      return;
   162	    }
   163	    setLayoutTranslationBusy(true);
   164	    setLayoutTranslationError(null);
   165	    try {
   166	      const job = await createLayoutTranslation({
   167	        documentId,
   168	        targetLanguage,
   169	        locale,
   170	        addToLibrary,
   171	      });
   172	      if (!layoutTranslationJobIdsRef.current.has(job.id)) {
   173	        layoutTranslationJobIdsRef.current.add(job.id);
   174	        addMessage({
   175	          id: `layout_translation_${job.id}`,
   176	          role: 'assistant',
   177	          text: tOr(
   178	            'layoutTranslation.chatMessage',
   179	            'I started a layout-preserving translation for this PDF. You can keep working while it runs.',
   180	            { language: layoutTranslationTargetLabel(targetLanguage) },
   181	          ),
   182	          artifacts: [job.artifact],
   183	          createdAt: Date.now(),
   184	        });
   185	      }
   186	      trackEvent('layout_translation_created', {
   187	        source: 'document_toolbar',
   188	        plan: userPlan || 'unknown',
   189	        target_language: targetLanguage,
   190	        add_to_library: addToLibrary,
   191	      });
   192	      setLayoutTranslationDrawerOpen(false);
   193	      setMobileTab('chat');
   194	    } catch (err) {
   195	      if (err instanceof ApiError && err.code === 'LAYOUT_TRANSLATION_LIMIT_REACHED') {
   196	        setLayoutPaywallReason(err.code);
   197	        setLayoutPaywallOpen(true);
   198	        trackEvent('limit_hit', {
   199	          source: 'layout_translation_toolbar',
   200	          reason: err.code,
   201	          plan: 'plus',
   202	          period: 'monthly',
   203	        });
   204	      } else {
   205	        setLayoutTranslationError(errorCopy(err, t, tOr));
   206	        setLayoutTranslationDrawerOpen(false);
   207	      }
   208	    } finally {
   209	      setLayoutTranslationBusy(false);
   210	    }
   211	  }, [addMessage, documentId, isLoggedIn, layoutTranslationBusy, locale, t, tOr, userPlan]);
   212	
   213	  const handlePreviewLayoutTranslation = useCallback((url: string, artifact: ChatArtifact) => {
   214	    const preview = artifact.preview && typeof artifact.preview === 'object'
   215	      ? artifact.preview as Record<string, unknown>
   216	      : {};
   217	    const pdfDownload = artifact.downloadUrls?.find((item) => item.format === 'pdf');
   218	    setTranslatedPreview({
   219	      url,
   220	      downloadUrl: pdfDownload?.url ? proxiedArtifactUrl(pdfDownload.url) : null,
   221	      targetLanguageLabel: typeof preview.target_language_label === 'string'
   222	        ? preview.target_language_label
   223	        : layoutTranslationTargetLabel(typeof preview.target_language === 'string' ? preview.target_language : null),
   224	      jobId: artifact.jobId || null,
   225	    });
   270	    >
   271	      <Quote size={14} aria-hidden="true" />
   272	      <span>{tOr('quoteFinder.toolbarLabel', 'Quote Finder')}</span>
   273	    </button>
   274	  ) : (
   275	    <button
   276	      type="button"
   277	      onClick={() => openAuthModal()}
   278	      className="flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-white/70 dark:text-zinc-400 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-blue-500"
   279	      title={tOr('quoteFinder.signInCta', 'Sign in to use Quote Finder')}
   280	    >
   281	      <LogIn size={14} aria-hidden="true" />
   282	      <span>{tOr('quoteFinder.signInCta', 'Sign in for Quote Finder')}</span>
   283	    </button>
   284	  );
   285	
   286	  const readerToolbar = (
   287	    <div className="dt-view-toggle flex items-center justify-between gap-2 px-2 py-1">
   288	      {viewToggle || <span />}
   289	      {quoteFinderEntry}
   290	    </div>
   291	  );
   292	
   293	  const viewerContent = (
   294	    <div className="h-full flex flex-col dt-reader-pane-document">
   295	      {readerToolbar}
   296	      {layoutTranslationError ? (
   297	        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
   298	          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
   299	          <span className="min-w-0 flex-1">
   300	            <span className="font-medium">{layoutTranslationError.title}: </span>
   301	            {layoutTranslationError.body}
   302	            {layoutTranslationError.cta && (
   303	              <button
   304	                type="button"
   305	                onClick={() => router.push(layoutTranslationError.cta!.href)}
   306	                className="ml-2 font-medium underline decoration-amber-500 underline-offset-2 hover:text-amber-700 dark:hover:text-amber-50"
   307	              >
   308	                {layoutTranslationError.cta.label}
   309	              </button>
   310	            )}
   311	          </span>
   312	          <button
   313	            type="button"
   314	            onClick={() => setLayoutTranslationError(null)}
   315	            className="rounded p-0.5 text-amber-800 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/40"
   316	            aria-label={tOr('common.dismiss', 'Dismiss')}
   317	          >
   318	            <X size={14} aria-hidden="true" />
   319	          </button>
   320	        </div>
   321	      ) : null}
   322	      <div className="flex-1 min-h-0">
   323	        {fileType === 'pdf' ? (
   324	          pdfUrl ? (
   325	            <div className="h-full min-h-0 flex flex-col">
   560	                    mobileTab === 'document'
   561	                      ? 'text-blue-600 dark:text-blue-400'
   562	                      : 'text-zinc-400 dark:text-zinc-500'
   563	                  }`}
   564	                >
   565	                  <FileText size={20} />
   566	                  {t('mobile.documentTab')}
   567	                </button>
   568	              </div>
   569	            </div>
   570	          )}
   571	        </>
   572	      )}
   573	      <CustomInstructionsModal
   574	        isOpen={showInstructions}
   575	        onClose={() => setShowInstructions(false)}
   576	        currentInstructions={customInstructions}
   577	        onSave={async (instructions) => {
   578	          await updateDocumentInstructions(documentId, instructions);
   579	          setCustomInstructions(instructions);
   580	        }}
   581	      />
   582	      <PaywallModal
   583	        isOpen={layoutPaywallOpen}
   584	        onClose={() => setLayoutPaywallOpen(false)}
   585	        reason={layoutPaywallReason}
   586	        currentPlan={userPlan}
   587	      />
   588	      <LayoutTranslationDrawer
   589	        isOpen={layoutTranslationDrawerOpen}
   590	        busy={layoutTranslationBusy}
   591	        documentName={documentName}
   592	        pageCount={totalPages || undefined}
   593	        userPlan={userPlan}
   594	        onClose={() => setLayoutTranslationDrawerOpen(false)}
   595	        onSubmit={handleLayoutTranslationSubmit}
   596	      />
   597	      <QuoteFinderPanel
   598	        isOpen={quoteFinderOpen}
   599	        documentId={documentId}
   600	        userPlan={userPlan}
   250	    }, 2500);
   251	    return () => {
   252	      cancelled = true;
   253	      window.clearInterval(timer);
   254	    };
   255	  }, [artifactDocumentId, tableJob, tableJobPending, tOr]);
   256	
   257	  const handleAiRebuild = async (tableId: string) => {
   258	    if (rebuildingTableId || tableJobPending) return;
   259	    setRebuildingTableId(tableId);
   260	    setTableRebuildError(null);
   261	    try {
   262	      const job = await reconstructDocumentTable(tableId);
   263	      setTableJob({ id: job.id, status: job.status, tableId });
   264	      setCurrent((prev) => ({
   265	        ...prev,
   266	        summary: tOr('tables.rebuildRunning', 'DocTalk is rebuilding the selected table with AI.'),
   267	      }));
   268	    } catch (err) {
   269	      setTableRebuildError(err instanceof Error ? err.message : 'AI table reconstruction failed');
   270	    } finally {
   271	      setRebuildingTableId(null);
   272	    }
   273	  };
   274	
   275	  const handlePreviewLayoutTranslation = () => {
   276	    if (!pdfDownload?.url) return;
   277	    onPreviewLayoutTranslation?.(absoluteProxiedArtifactUrl(pdfDownload.url), current);
   278	  };
   279	
   280	  const handleImportLayoutTranslation = async () => {
   281	    if (!current.jobId || layoutImporting || importedDocumentId) return;
   282	    setLayoutImporting(true);
   283	    setLayoutImportError(null);
   284	    try {
   285	      const result = await importLayoutTranslationDocument(current.jobId, locale);
   286	      setCurrent((prev) => ({
   287	        ...prev,
   288	        preview: {
   289	          ...(prev.preview && typeof prev.preview === 'object' ? prev.preview as Record<string, unknown> : {}),
   290	          imported_document_id: result.document_id,
   291	          imported_document_filename: result.filename,
   292	          imported_document_status: result.status,
   293	          import_error: null,
   294	        },
   295	      }));
   296	    } catch (err) {
   297	      setLayoutImportError(errorCopy(err, t, tOr));
   298	    } finally {
   299	      setLayoutImporting(false);
   300	    }
   301	  };
   302	
   303	  useEffect(() => {
   304	    if (!isLayoutTranslation || !isDone || !importRequested || importedDocumentId || autoImportAttemptedRef.current) return;
   305	    autoImportAttemptedRef.current = true;
   306	    void handleImportLayoutTranslation();
   307	    // eslint-disable-next-line react-hooks/exhaustive-deps
   308	  }, [importRequested, importedDocumentId, isDone, isLayoutTranslation]);
   309	
   310	  return (
   311	    <div className="not-prose mt-4 overflow-hidden rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-solid)] shadow-sm">
   312	      <div className="flex items-start gap-3 border-b border-[var(--reader-border)] px-4 py-3">
   313	        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--reader-evidence-border)] bg-[var(--reader-evidence-soft)] text-[var(--reader-evidence)]">
   314	          <Icon size={18} aria-hidden="true" />
   315	        </div>
   316	        <div className="min-w-0 flex-1">
   317	          <div className="flex flex-wrap items-center gap-2">
   318	            <p className="text-sm font-semibold text-[var(--reader-ink)]">{displayTitle}</p>
   319	            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
   320	              isFailed
   321	                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
   322	                : isDone
   323	                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
   324	                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
   325	            }`}>
   326	              {isFailed ? <AlertTriangle size={12} /> : isDone ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
   327	              {current.status}
   328	            </span>
   329	          </div>
   330	          <p className="mt-1 text-sm leading-relaxed text-[var(--reader-muted)]">{displaySummary}</p>
   331	          {tableRebuildError ? (
   332	            <p className="mt-2 text-xs text-red-700 dark:text-red-300">{tableRebuildError}</p>
   333	          ) : null}
   334	          {layoutImportError ? (
   335	            <p className="mt-2 text-xs text-red-700 dark:text-red-300">
   336	              {layoutImportError.title}: {layoutImportError.body}
   337	              {layoutImportError.cta && (
   338	                <Link
   339	                  href={layoutImportError.cta.href}
   340	                  className="ml-1 font-medium underline decoration-red-400 underline-offset-2 hover:text-red-800 dark:hover:text-red-100"
   341	                >
   342	                  {layoutImportError.cta.label}
   343	                </Link>
   344	              )}
   345	            </p>
   346	          ) : null}
   347	          {isLayoutTranslation && typeof layoutPreview.import_error === 'string' && layoutPreview.import_error ? (
   348	            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{layoutPreview.import_error}</p>
   349	          ) : null}
   350	          {current.warning ? (
   351	            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{current.warning}</p>
   352	          ) : null}
   353	        </div>
   354	        {isPending ? <RefreshCw size={16} className="mt-2 shrink-0 animate-spin text-[var(--reader-muted)] motion-reduce:animate-none" /> : null}
   355	      </div>
frontend/src/lib/api.ts:241:export async function importLayoutTranslationDocument(jobId: string, locale?: string | null): Promise<LayoutTranslationImportResponse> {
frontend/src/components/Chat/ChatArtifactCard.tsx:7:import { getDocumentJob, getTableScanJob, importLayoutTranslationDocument, listDocumentTables, reconstructDocumentTable } from '../../lib/api';
frontend/src/components/Chat/ChatArtifactCard.tsx:285:      const result = await importLayoutTranslationDocument(current.jobId, locale);

exec
/bin/zsh -lc "rg -n 'DOCUMENT_LIMIT_REACHED|targetPlan|Pro|openPaywall|DOMAIN_MODE' .collab/reviews/2026-08-03-p1-paywall-coverage-report.md .collab/reviews/2026-08-03-p1-hygiene-backend-report.md .collab/dialogue/2026-08-03-p1-hygiene-codex-request.md
nl -ba .collab/reviews/2026-08-03-p1-paywall-coverage-report.md | sed -n '1,240p'
rg -n 'function importLayoutTranslationDocument|import-document|import.*layout' frontend/src/lib/api.ts backend/app/api/layout_translations.py
nl -ba backend/app/api/layout_translations.py | sed -n '420,560p'
nl -ba frontend/src/lib/api.ts | sed -n '220,255p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
.collab/dialogue/2026-08-03-p1-hygiene-codex-request.md:11:1. **domain_mode backend gate** (b6da842 chat.py, ef7e798 extractions.py, 1fab067 cleanup): `domain_mode` ("legal"/"academic") was Plus-gated frontend-only; backend accepted it unconditionally → free/anon users got paid domain-rules prompt behavior. Now BOTH input entry points (the only two: `ChatRequest.domain_mode`→chat.py chat_stream, `CreateExtractionRequest.domain_mode`→extractions.py create_extraction) gate with 403 `{"error":"DOMAIN_MODE_REQUIRES_PLUS","required_plan":"plus"}` when `domain_mode is not None AND plan not in {plus,pro}`; omitted → untouched; plus/pro → applies. Continuation endpoint has no domain_mode field and never touches DOMAIN_RULES; chat_stream re-sources domain_mode per-message and CLEARS the persisted session value when omitted (no downgrade-replay vector); collection chat routes through the same gated endpoint.
.collab/dialogue/2026-08-03-p1-hygiene-codex-request.md:12:2. **paywall coverage** (dc18eff docs, 4cd4c8a, 78f660b, 28c0977, 1a2dcc8): surfaced upgrade CTAs/PaywallModal at 5 dead-end limit sites — SHARE_LIMIT_REACHED (ChatPanel), DOCUMENT_LIMIT_REACHED (2 layout-translation paths), DOMAIN_MODE_REQUIRES_PLUS e2e on chat SSE (useChatStream trigger + errorCopy + PaywallModal case + deriveUpgradePlan) and REST extraction (ExtractionPanel). 6 i18n keys ×11.
.collab/dialogue/2026-08-03-p1-hygiene-codex-request.md:15:Gate has no bypass under adversarial tracing (continuation replay + collection-chat both checked); `.openPaywall` flag removed from the 403 entry (was inert — zero consumers — but contradicted its own invariant: 403s use inline CTA, only 402/MODE_NOT_ALLOWED auto-modal); i18n ×11 parity; palette clean; `npm run build` + targeted pytest + ruff all pass at HEAD.
.collab/dialogue/2026-08-03-p1-hygiene-codex-request.md:18:(1) ANY residual path where a free/anon request gets domain-rules behavior — replay of a persisted value, a service param sourced pre-gate, an unlisted endpoint, the collection path, extraction retry. (2) Gate over-fire — can it block ordinary free chat/extraction with no domain_mode? (3) The `openPaywall` invariant (finding the internal reviewer flagged): confirm removing it is correct and no surface actually needed auto-modal for these 403s. (4) 403 vs 402: does the frontend paywall/CTA path fire on CODE not status on both chat-SSE and REST-extraction routes? (5) Any new dead-end (a surfaced CTA that doesn't route to billing) or injection via the ChatPanel markdown-link CTA. (6) i18n truth.
.collab/reviews/2026-08-03-p1-hygiene-backend-report.md:27:                "error": "DOMAIN_MODE_REQUIRES_PLUS",
.collab/reviews/2026-08-03-p1-hygiene-backend-report.md:28:                "message": "Legal/Academic domain mode requires a Plus or Pro plan",
.collab/reviews/2026-08-03-p1-hygiene-backend-report.md:38:Went back and forth on this mid-task (see the conversation trail) — the team lead's follow-up message raised switching to 402 to align with the frontend's `useChatStream`/`PaywallModal` auto-handling of `status === 402`. Research confirmed that mechanism is real (a bare 402 alone, regardless of error code string, routes into the paywall-modal branch and fires `limit_hit`/`paywall_opened` telemetry client-side) — but also found `PaywallModal.tsx`'s `paywallCopy()` has no branch for a new code, so a 402 alone would open the modal with the wrong ("insufficient credits") copy without an accompanying frontend change. The team lead then confirmed the **original 403 / `DOMAIN_MODE_REQUIRES_PLUS` / `required_plan: "plus"` choice was exactly right** and intended — matching the `PLAN_REQUIRED`/`required_plan` convention already used by `question_templates.py`, `tables.py`, and (not coincidentally) `extractions.py`'s own pre-existing `EXTRACTION_LIMIT_REACHED` gate, which uses the identical shape one function above where this fix landed. Shipped as 403, not 402 — noting the 402/PaywallModal path exists as a documented alternative if the team ever wants this to surface as an in-app upgrade prompt instead of a generic error.
.collab/reviews/2026-08-03-p1-hygiene-backend-report.md:48:1. **Free plan + `domain_mode` set → 403** `DOMAIN_MODE_REQUIRES_PLUS`, `required_plan == "plus"`.
.collab/reviews/2026-08-03-p1-hygiene-backend-report.md:50:3. **`domain_mode` omitted → reaches the NEXT check**, never the domain_mode gate (regression guard against the gate over-firing and blocking ordinary free-plan usage). Proven by asserting the response is a *different*, deterministic downstream rejection (`RATE_LIMITED` for chat, `EXTRACTION_LIMIT_REACHED` for extractions) rather than just checking "not 403."
.collab/reviews/2026-08-03-p1-hygiene-backend-report.md:57:- **Documentation gap**: `.claude/rules/frontend.md`'s feature-gating list (Subscriptions & Feature Gating section) enumerated every other backend-gated feature (Custom Instructions, Sessions, Saved quotes) but omitted Domain Mode entirely — added: `Domain Mode (legal/academic chat overlay): Plus+ (backend gated, chat.py's chat_stream — 403 DOMAIN_MODE_REQUIRES_PLUS).`
.collab/reviews/2026-08-03-p1-paywall-coverage-report.md:19:### 1. DOCUMENT_LIMIT_REACHED — mixed (2 of 4 trigger sites are gaps)
.collab/reviews/2026-08-03-p1-paywall-coverage-report.md:50:DOCUMENT_LIMIT_REACHED. Confirmed rendered with `.cta` link.
.collab/reviews/2026-08-03-p1-paywall-coverage-report.md:106:### 8. DOMAIN_MODE_REQUIRES_PLUS — new code, two trigger sites, both gaps
.collab/reviews/2026-08-03-p1-paywall-coverage-report.md:123:- `frontend/src/lib/errorCopy.ts` — add a `DOMAIN_MODE_REQUIRES_PLUS`
.collab/reviews/2026-08-03-p1-paywall-coverage-report.md:125:  helper (backend sends `required_plan`), `openPaywall: true`, mirroring
.collab/reviews/2026-08-03-p1-paywall-coverage-report.md:129:  `code === 'DOMAIN_MODE_REQUIRES_PLUS'` to `handleStreamError`'s hardcoded
.collab/reviews/2026-08-03-p1-paywall-coverage-report.md:136:  explicit `DOMAIN_MODE_REQUIRES_PLUS` case.
.collab/reviews/2026-08-03-p1-paywall-coverage-report.md:138:  `DOMAIN_MODE_REQUIRES_PLUS` case to `deriveUpgradePlan()` → always `'plus'`
.collab/reviews/2026-08-03-p1-paywall-coverage-report.md:147:`DOMAIN_MODE_REQUIRES_PLUS` to the trigger condition (~213) and a copy branch
.collab/reviews/2026-08-03-p1-paywall-coverage-report.md:154:   branch: render DOCUMENT_LIMIT_REACHED's `.cta` inline instead of
.collab/reviews/2026-08-03-p1-paywall-coverage-report.md:159:   `billingLinks.ts` — full DOMAIN_MODE_REQUIRES_PLUS path for chat SSE.
.collab/reviews/2026-08-03-p1-paywall-coverage-report.md:160:5. `ExtractionPanel.tsx` — DOMAIN_MODE_REQUIRES_PLUS in the REST extraction
.collab/reviews/2026-08-03-p1-paywall-coverage-report.md:163:No changes needed: DOCUMENT_LIMIT_REACHED (upload/URL-ingest sites),
     1	# P1 hygiene: paywall upgrade-path coverage audit
     2	
     3	Date: 2026-08-03
     4	Scope: for each plan-limit error code in play, verify whether its actual
     5	render site surfaces an upgrade path (PaywallModal or inline CTA linking to
     6	billing), or dead-ends on inline copy with no way forward. Per-code, not
     7	per-handler — the same code can have multiple trigger sites and multiple
     8	consumers, and a code that's "fixed" at one site can still dead-end at
     9	another.
    10	
    11	Already-done codes per the task brief (INSUFFICIENT_CREDITS, MODE_NOT_ALLOWED,
    12	PRO_MODE_LIMIT_REACHED, BALANCED_MODE_LIMIT_REACHED,
    13	LAYOUT_TRANSLATION_LIMIT_REACHED) were not re-audited — confirmed already
    14	routed through PaywallModal via `useChatStream.ts`'s `handleStreamError`
    15	hardcoded list.
    16	
    17	## Findings
    18	
    19	### 1. DOCUMENT_LIMIT_REACHED — mixed (2 of 4 trigger sites are gaps)
    20	
    21	Backend raises it at four sites, not one:
    22	- `backend/app/api/documents.py:227` — direct upload
    23	- `backend/app/api/documents.py:361` — URL ingest
    24	- `backend/app/api/layout_translations.py` `_assert_document_capacity()`
    25	  (defined ~163), called at lines 261/277 inside `create_layout_translation`
    26	  when `add_to_library` is set
    27	- `backend/app/api/layout_translations.py:459` — `import_layout_translation_document`
    28	  ("Add to DocTalk" import of a finished translation)
    29	
    30	| Trigger | Consumer | Status |
    31	|---|---|---|
    32	| documents.py:227, :361 | `frontend/src/components/dashboard/DashboardPageClient.tsx` (client pre-check ~227-240, server-error catch ~300-307) | **Fixed.** `errorCopy()` computed, `.cta` rendered as a clickable `<Link>` (lines ~459-465, ~498-504). |
    33	| layout_translations.py add_to_library (261/277) | `frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx`, `handleLayoutTranslationSubmit` else-branch (~204-208) | **Gap.** Collapses `errorCopy()` into a plain string (`` `${copy.title}: ${copy.body}` ``) stored in `layoutTranslationError: string | null`, rendered as a plain amber banner (~297-303). `.cta` is computed and discarded. |
    34	| layout_translations.py:459 (import) | `frontend/src/components/Chat/ChatArtifactCard.tsx`, `handleImportLayoutTranslation` (~276-306) | **Gap.** Doesn't call `errorCopy()` at all — `setLayoutImportError(err instanceof Error ? err.message : 'Document import failed')` stores the raw/technical message, rendered as plain red text (~332-333). No upgrade path. |
    35	
    36	**Plan:** for both gaps, compute `errorCopy()` (already imported/used elsewhere
    37	in both files) and render `.title`/`.body`/`.cta` inline, mirroring the
    38	pattern this same DocumentReaderPageClient.tsx file already uses for
    39	`sessionErrorCopy` (title, body, clickable cta button). Not routing through
    40	the existing layout-translation `PaywallModal` on that surface — that modal's
    41	`paywallCopy()` switch has no detail-interpolation path (no `limit`/`plan`
    42	params reach it) and is scoped to `LAYOUT_TRANSLATION_LIMIT_REACHED`
    43	specifically; conflating a generic document-count cap into it would need
    44	new plumbing for no real benefit when `errorCopy()` already renders a fully
    45	correct, tested CTA inline elsewhere in the same file.
    46	
    47	### 2. FILE_TOO_LARGE — fixed, no action
    48	
    49	`documents.py:253,423,468` → same `DashboardPageClient.tsx` catch path as
    50	DOCUMENT_LIMIT_REACHED. Confirmed rendered with `.cta` link.
    51	
    52	### 3. URL_CONTENT_TOO_LARGE — not a plan limit, no CTA warranted
    53	
    54	`documents.py:386`, detail is `{message}` only (no `plan`/`limit` fields).
    55	Traced to `backend/app/services/extractors/url_extractor.py`:
    56	`MAX_CONTENT_SIZE = 10 * 1024 * 1024` — a fixed 10MB constant, not
    57	plan-dependent. `errorCopy.ts`'s existing `URL_CONTENT_TOO_LARGE` entry
    58	correctly has no `cta`. No fix — an upgrade CTA here would be false: paying
    59	more doesn't raise this cap.
    60	
    61	### 4. SESSION_LIMIT_REACHED — fixed at both trigger sites, no action
    62	
    63	`backend/app/api/chat.py:244,267` inside `create_session` (free plan, 3/doc).
    64	Two independent frontend consumers:
    65	- `frontend/src/lib/useChatSession.ts` → `sessionError` → consumed by
    66	  `DocumentReaderPageClient.tsx` (`sessionErrorCopy`, rendered with cta
    67	  button, ~434-440).
    68	- `frontend/src/components/SessionDropdown.tsx`'s own `onNewChat()` (a
    69	  second, more-frequently-hit trigger — "New Chat" from the session
    70	  dropdown) — independently computes `errorCopy()` into its own
    71	  `sessionErrorCopy` state and renders `.cta` as a `<Link>` (~254-260).
    72	
    73	Both confirmed fixed.
    74	
    75	### 5. COLLECTION_LIMIT_REACHED — fixed, no action
    76	
    77	`backend/app/api/collections.py:132` (`create_collection`) →
    78	`frontend/src/components/Collections/CreateCollectionModal.tsx`,
    79	`handleCreate()` computes `errorCopy()` into `createErrorCopy` state,
    80	rendered with a clickable cta `<Link>` (~205-213).
    81	
    82	### 6. COLLECTION_DOC_LIMIT_REACHED — fixed, no action
    83	
    84	`backend/app/api/collections.py:277` (add documents) →
    85	`frontend/src/app/collections/[collectionId]/page.tsx`, `errorCopy()` at
    86	~187, rendered with cta at ~542-548.
    87	
    88	### 7. SHARE_LIMIT_REACHED — gap
    89	
    90	`backend/app/api/sharing.py:84` (`create_share`, free plan capped at 3 active
    91	shares) → `frontend/src/components/Chat/ChatPanel.tsx`, both `handleShare()`
    92	(~391-418) and `handleShareAnswer()` (~420-445+). Both compute
    93	`const copy = errorCopy(e, t, tOr);` then discard `.cta`, pushing only
    94	`copy.body` as plain text into a chat-transcript "error message" bubble
    95	(`role: 'assistant', isError: true`).
    96	
    97	**Plan:** `MessageBubble.tsx` confirmed (lines 258-320): `isError` messages
    98	are NOT the `isUser` branch, so they render through the same `ReactMarkdown`
    99	pipeline as normal assistant answers (only styling differs — red bubble).
   100	A plain markdown link in `copy.body`/appended text will render as a real
   101	clickable `<a>`. Append `copy.cta` as a markdown link
   102	(`\n\n[label](href)`) to the message text when `.cta` is present — matches
   103	this file's existing "chat bubble as feedback channel" pattern for
   104	share-success confirmations, with the smallest possible diff.
   105	
   106	### 8. DOMAIN_MODE_REQUIRES_PLUS — new code, two trigger sites, both gaps
   107	
   108	Backend raises 403 with `{required_plan: "plus"}` at two independent sites
   109	(same check, added same day per code comments):
   110	- `backend/app/api/chat.py:405` — inside `chat_stream`, before any
   111	  `StreamingResponse` starts (confirmed via reading lines 330-420: plain
   112	  `async def`, so this surfaces as a normal pre-stream HTTP 403, not a
   113	  mid-stream SSE `error` event).
   114	- `backend/app/api/extractions.py:200` — inside `create_extraction` (REST),
   115	  explicitly the "second entry point" per its own code comment.
   116	
   117	| Trigger | Consumer | Status |
   118	|---|---|---|
   119	| chat.py:405 (chat SSE) | `frontend/src/lib/useChatStream.ts`, `handleStreamError` | **Gap.** Hardcoded paywall-trigger code list (`INSUFFICIENT_CREDITS` / `MODE_NOT_ALLOWED` / `PRO_MODE_LIMIT_REACHED` / `BALANCED_MODE_LIMIT_REACHED` / `status===402`) does not include this code — falls through to generic chat-bubble error text. |
   120	| extractions.py:200 (REST) | `frontend/src/components/Extraction/ExtractionPanel.tsx`, `runExtraction()` catch (~212-217) | **Gap.** `paywallCode` trigger condition only checks `INSUFFICIENT_CREDITS` / `EXTRACTION_LIMIT_REACHED`; this code falls to `setError(err.message)`, a raw string with no CTA. Note: the panel reads `domainMode` from the global Zustand store (shared with chat's `DomainModeSelector`, which already disables the selector for free users) — this makes the REST path narrow in practice, but not unreachable (stale/race state), and it's a dead end today regardless. |
   121	
   122	**Plan (4 files, chat SSE path):**
   123	- `frontend/src/lib/errorCopy.ts` — add a `DOMAIN_MODE_REQUIRES_PLUS`
   124	  CODE_TABLE entry using the existing `requiredPlanCta(detail, tOr, reason)`
   125	  helper (backend sends `required_plan`), `openPaywall: true`, mirroring
   126	  `MODE_NOT_ALLOWED`'s shape. (Covers any non-SSE/generic consumer that runs
   127	  errors through `errorCopy()`, and keeps the table complete.)
   128	- `frontend/src/lib/useChatStream.ts` — add
   129	  `code === 'DOMAIN_MODE_REQUIRES_PLUS'` to `handleStreamError`'s hardcoded
   130	  paywall-trigger list, so it calls `onShowPaywall(reason)` like the mode-cap
   131	  family.
   132	- `frontend/src/components/PaywallModal.tsx` — `paywallCopy()` is a separate
   133	  switch keyed only on the reason string (no error detail reaches it), so
   134	  routing to `onShowPaywall()` alone would fall through to the generic
   135	  "Insufficient Credits" copy — wrong message for a plan-gate. Add an
   136	  explicit `DOMAIN_MODE_REQUIRES_PLUS` case.
   137	- `frontend/src/lib/billingLinks.ts` — add an explicit
   138	  `DOMAIN_MODE_REQUIRES_PLUS` case to `deriveUpgradePlan()` → always `'plus'`
   139	  (this gate only ever fires for free-plan users, since plus/pro already
   140	  pass the backend check, so the existing generic fallback would resolve
   141	  the same value — but an explicit case keeps intent legible and matches
   142	  the `LAYOUT_TRANSLATION_LIMIT_REACHED` precedent).
   143	
   144	**Plan (REST extraction path):** `ExtractionPanel.tsx` already has a working
   145	inline paywall-banner pattern for `EXTRACTION_LIMIT_REACHED`/
   146	`INSUFFICIENT_CREDITS` using `billingHref()` directly (~464-478) — add
   147	`DOMAIN_MODE_REQUIRES_PLUS` to the trigger condition (~213) and a copy branch
   148	in the existing render block. No new modal, no new dependency.
   149	
   150	## Summary of genuine gaps to fix (5 surfaces, 1 commit each)
   151	
   152	1. `ChatPanel.tsx` — render SHARE_LIMIT_REACHED's `.cta` in the error bubble.
   153	2. `DocumentReaderPageClient.tsx` — `handleLayoutTranslationSubmit` else
   154	   branch: render DOCUMENT_LIMIT_REACHED's `.cta` inline instead of
   155	   collapsing to a string.
   156	3. `ChatArtifactCard.tsx` — `handleImportLayoutTranslation`: switch from raw
   157	   `err.message` to `errorCopy()` + inline cta.
   158	4. `errorCopy.ts` + `useChatStream.ts` + `PaywallModal.tsx` +
   159	   `billingLinks.ts` — full DOMAIN_MODE_REQUIRES_PLUS path for chat SSE.
   160	5. `ExtractionPanel.tsx` — DOMAIN_MODE_REQUIRES_PLUS in the REST extraction
   161	   paywall banner.
   162	
   163	No changes needed: DOCUMENT_LIMIT_REACHED (upload/URL-ingest sites),
   164	FILE_TOO_LARGE, URL_CONTENT_TOO_LARGE, SESSION_LIMIT_REACHED,
   165	COLLECTION_LIMIT_REACHED, COLLECTION_DOC_LIMIT_REACHED — already fixed or,
   166	for URL_CONTENT_TOO_LARGE, correctly CTA-less.
   167	
   168	Every new/changed user-facing string needs all 11 locale files updated
   169	(flat dotted keys) alongside the `en` source.
backend/app/api/layout_translations.py:186:    from app.workers.layout_translation_worker import run_layout_translation_job
backend/app/api/layout_translations.py:412:    "/layout-translations/{job_id}/import-document",
backend/app/api/layout_translations.py:416:async def import_layout_translation_document(
frontend/src/lib/api.ts:241:export async function importLayoutTranslationDocument(jobId: string, locale?: string | null): Promise<LayoutTranslationImportResponse> {
frontend/src/lib/api.ts:242:  const res = await fetch(`${PROXY_BASE}/api/layout-translations/${jobId}/import-document`, {
   420	    db: AsyncSession = Depends(get_db_session),
   421	):
   422	    row = await db.execute(
   423	        select(DocumentJob)
   424	        .where(DocumentJob.id == job_id)
   425	        .where(DocumentJob.user_id == user.id)
   426	        .where(DocumentJob.job_type == LAYOUT_TRANSLATION_JOB_TYPE)
   427	    )
   428	    job = row.scalar_one_or_none()
   429	    if not job:
   430	        raise HTTPException(
   431	            status_code=404,
   432	            detail={"error": "DOCUMENT_JOB_NOT_FOUND", "message": "Document job not found"},
   433	        )
   434	    if job.status != "succeeded":
   435	        raise HTTPException(
   436	            status_code=409,
   437	            detail={"error": "LAYOUT_TRANSLATION_NOT_READY", "message": "Translated PDF is not ready yet"},
   438	        )
   439	
   440	    existing = await _existing_import_response(job, db)
   441	    if existing:
   442	        return existing
   443	
   444	    metadata = job.metadata_json or {}
   445	    artifacts = metadata.get("artifacts") if isinstance(metadata, dict) else None
   446	    item = artifacts.get("pdf") if isinstance(artifacts, dict) else None
   447	    if not isinstance(item, dict):
   448	        raise HTTPException(
   449	            status_code=404,
   450	            detail={"error": "LAYOUT_TRANSLATION_ARTIFACT_NOT_FOUND", "message": "Translated PDF not found"},
   451	        )
   452	    storage_key = item.get("storage_key")
   453	    if not isinstance(storage_key, str) or not storage_key:
   454	        raise HTTPException(
   455	            status_code=404,
   456	            detail={"error": "LAYOUT_TRANSLATION_ARTIFACT_NOT_FOUND", "message": "Translated PDF not found"},
   457	        )
   458	
   459	    await _assert_document_capacity(user, db)
   460	    content = await asyncio.to_thread(storage_service.download_file, storage_key)
   461	    if not content.startswith(b"%PDF"):
   462	        raise HTTPException(
   463	            status_code=502,
   464	            detail={"error": "LAYOUT_TRANSLATION_INVALID_ARTIFACT", "message": "Translated PDF is invalid"},
   465	        )
   466	
   467	    filename = _translated_import_filename(job, item)
   468	
   469	    class _MemUpload:
   470	        content_type = "application/pdf"
   471	
   472	        def __init__(self, name: str, data: bytes) -> None:
   473	            self.filename = name
   474	            self._data = data
   475	
   476	        async def read(self):
   477	            return self._data
   478	
   479	    document_id = await doc_service.create_document(
   480	        _MemUpload(filename, content),
   481	        db,
   482	        user_id=user.id,
   483	        file_type="pdf",
   484	        locale=(body.locale if body else None) or str(metadata.get("target_language") or DEFAULT_LAYOUT_TRANSLATION_TARGET),
   485	    )
   486	    job.metadata_json = {
   487	        **(job.metadata_json or {}),
   488	        "imported_document_id": str(document_id),
   489	        "imported_document_filename": filename,
   490	        "imported_document_status": "parsing",
   491	        "import_error": None,
   492	    }
   493	    db.add(
   494	        ProductEvent(
   495	            user_id=user.id,
   496	            event_name="layout_translation_imported_document",
   497	            source="document_reader",
   498	            reason=str(metadata.get("target_language") or DEFAULT_LAYOUT_TRANSLATION_TARGET),
   499	            plan=(user.plan or "free").lower(),
   500	            metadata_json={
   501	                "job_id": str(job.id),
   502	                "source_document_id": str(job.document_id) if job.document_id else None,
   503	                "imported_document_id": str(document_id),
   504	                "target_language": metadata.get("target_language"),
   505	            },
   506	        )
   507	    )
   508	    await db.commit()
   509	
   510	    return ImportLayoutTranslationResponse(
   511	        document_id=str(document_id),
   512	        status="parsing",
   513	        filename=filename,
   514	        existing=False,
   515	    )
   516	
   517	
   518	@router.get("/layout-translations/{job_id}/download")
   519	async def download_layout_translation_artifact(
   520	    job_id: uuid.UUID,
   521	    artifact: Literal["pdf", "markdown", "bundle"] = Query("pdf"),
   522	    user: User = Depends(require_auth),
   523	    db: AsyncSession = Depends(get_db_session),
   524	):
   525	    row = await db.execute(
   526	        select(DocumentJob)
   527	        .where(DocumentJob.id == job_id)
   528	        .where(DocumentJob.user_id == user.id)
   529	        .where(DocumentJob.job_type == LAYOUT_TRANSLATION_JOB_TYPE)
   530	    )
   531	    job = row.scalar_one_or_none()
   532	    metadata = job.metadata_json if job else {}
   533	    artifacts = metadata.get("artifacts") if isinstance(metadata, dict) else None
   534	    item = artifacts.get(artifact) if isinstance(artifacts, dict) else None
   535	    if not job or job.status != "succeeded" or not isinstance(item, dict):
   536	        raise HTTPException(
   537	            status_code=404,
   538	            detail={"error": "LAYOUT_TRANSLATION_ARTIFACT_NOT_FOUND", "message": "Translated artifact not found"},
   539	        )
   540	    storage_key = item.get("storage_key")
   541	    if not isinstance(storage_key, str) or not storage_key:
   542	        raise HTTPException(
   543	            status_code=404,
   544	            detail={"error": "LAYOUT_TRANSLATION_ARTIFACT_NOT_FOUND", "message": "Translated artifact not found"},
   545	        )
   546	    content = await asyncio.to_thread(storage_service.download_file, storage_key)
   547	    filename = str(item.get("filename") or f"layout-translation-{job.id}.{artifact}")
   548	    content_type = str(item.get("content_type") or "application/octet-stream")
   549	    return StreamingResponse(
   550	        iter([content]),
   551	        media_type=content_type,
   552	        headers={"Content-Disposition": _content_disposition(filename)},
   553	    )
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

exec
/bin/zsh -lc "rg -n --glob '*.{ts,tsx}' 'searchParams.*plan|selectedPlan|planParam|initialPlan|currentPlan|checkout.*plan' frontend/src/app/billing frontend/src/components/Billing frontend/src | head -n 240
rg -n --glob '*.{ts,tsx}' 'billingHref\\(\\{["'^'"\\n]*plan' frontend/src | head -n 120
rg -n --glob '*.py' 'plan.*Literal|plan: Mapped|PLAN' backend/app/models/tables.py backend/app/schemas backend/app/api/billing.py | head -n 160
git diff --check ba8a141..HEAD" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
rg: frontend/src/components/Billing: No such file or directory (os error 2)
frontend/src/app/billing/BillingPageClient.tsx:96:  const [selectedPlan, setSelectedPlan] = useState<'plus' | 'pro'>('plus');
frontend/src/app/billing/BillingPageClient.tsx:114:    const planParam = searchParams.get("plan");
frontend/src/app/billing/BillingPageClient.tsx:117:    if (planParam === "plus" || planParam === "pro") {
frontend/src/app/billing/BillingPageClient.tsx:118:      setSelectedPlan(planParam as BillingPlanIntent);
frontend/src/app/billing/BillingPageClient.tsx:123:    if (planParam === "plus" || planParam === "pro" || searchParams.get("source") || searchParams.get("reason")) {
frontend/src/app/billing/BillingPageClient.tsx:125:        plan: planParam || "plus",
frontend/src/app/billing/BillingPageClient.tsx:283:    const currentPlan = (profile?.plan || 'free') as PlanType;
frontend/src/app/billing/BillingPageClient.tsx:285:    if (currentPlan === 'free') {
frontend/src/app/billing/BillingPageClient.tsx:290:    if (currentPlan === plan) {
frontend/src/app/billing/BillingPageClient.tsx:294:    const isUpgrade = PLAN_HIERARCHY[plan] > PLAN_HIERARCHY[currentPlan];
frontend/src/app/billing/BillingPageClient.tsx:451:  const currentPlanLabel = profile
frontend/src/app/billing/BillingPageClient.tsx:463:      value: currentPlanLabel,
frontend/src/app/billing/BillingPageClient.tsx:567:            aria-label={t('billing.currentPlan.title')}
frontend/src/app/billing/BillingPageClient.tsx:572:                  {t('billing.currentPlan.title')}
frontend/src/app/billing/BillingPageClient.tsx:577:                    · {t(`billing.currentPlan.managed.${profile.billing_state.managed_by}`)}
frontend/src/app/billing/BillingPageClient.tsx:582:                    {t('billing.currentPlan.scheduledCancel', {
frontend/src/app/billing/BillingPageClient.tsx:591:                      {t('billing.currentPlan.renewsOn', {
frontend/src/app/billing/BillingPageClient.tsx:705:                  selectedPlan === 'plus'
frontend/src/app/billing/BillingPageClient.tsx:753:                        {t("billing.currentPlan.title")}
frontend/src/app/billing/BillingPageClient.tsx:780:                  selectedPlan === 'pro'
frontend/src/app/billing/BillingPageClient.tsx:823:                        {t("billing.currentPlan.title")}
frontend/src/app/billing/BillingPageClient.tsx:869:                currentPlan={profile?.plan as PlanType || 'free'}
frontend/src/app/billing/BillingPageClient.tsx:871:                selectedPlan={selectedPlan}
frontend/src/lib/useChatStream.ts:28:  currentPlan?: string;
frontend/src/lib/useChatStream.ts:51:  currentPlan,
frontend/src/lib/useChatStream.ts:197:      // (currentPlan, reason) so the upgrade-funnel analytics aren't poisoned.
frontend/src/lib/useChatStream.ts:198:      const upgradePlan = deriveUpgradePlan(currentPlan, reason);
frontend/src/lib/useChatStream.ts:265:  }, [addMessage, flushPendingText, getErrorMeta, isAbortLikeError, onShowPaywall, setStreaming, t, tOr, currentPlan]);
frontend/src/lib/billingLinks.ts:46:  currentPlan: string | undefined,
frontend/src/lib/billingLinks.ts:56:    return currentPlan === 'plus' ? 'pro' : 'plus';
frontend/src/lib/billingLinks.ts:59:  if (currentPlan === 'plus' || currentPlan === 'pro') {
frontend/src/app/billing/BillingPageClient.tsx:96:  const [selectedPlan, setSelectedPlan] = useState<'plus' | 'pro'>('plus');
frontend/src/app/billing/BillingPageClient.tsx:114:    const planParam = searchParams.get("plan");
frontend/src/app/billing/BillingPageClient.tsx:117:    if (planParam === "plus" || planParam === "pro") {
frontend/src/app/billing/BillingPageClient.tsx:118:      setSelectedPlan(planParam as BillingPlanIntent);
frontend/src/app/billing/BillingPageClient.tsx:123:    if (planParam === "plus" || planParam === "pro" || searchParams.get("source") || searchParams.get("reason")) {
frontend/src/app/billing/BillingPageClient.tsx:125:        plan: planParam || "plus",
frontend/src/app/billing/BillingPageClient.tsx:283:    const currentPlan = (profile?.plan || 'free') as PlanType;
frontend/src/app/billing/BillingPageClient.tsx:285:    if (currentPlan === 'free') {
frontend/src/app/billing/BillingPageClient.tsx:290:    if (currentPlan === plan) {
frontend/src/app/billing/BillingPageClient.tsx:294:    const isUpgrade = PLAN_HIERARCHY[plan] > PLAN_HIERARCHY[currentPlan];
frontend/src/app/billing/BillingPageClient.tsx:451:  const currentPlanLabel = profile
frontend/src/app/billing/BillingPageClient.tsx:463:      value: currentPlanLabel,
frontend/src/app/billing/BillingPageClient.tsx:567:            aria-label={t('billing.currentPlan.title')}
frontend/src/app/billing/BillingPageClient.tsx:572:                  {t('billing.currentPlan.title')}
frontend/src/app/billing/BillingPageClient.tsx:577:                    · {t(`billing.currentPlan.managed.${profile.billing_state.managed_by}`)}
frontend/src/app/billing/BillingPageClient.tsx:582:                    {t('billing.currentPlan.scheduledCancel', {
frontend/src/app/billing/BillingPageClient.tsx:591:                      {t('billing.currentPlan.renewsOn', {
frontend/src/app/billing/BillingPageClient.tsx:705:                  selectedPlan === 'plus'
frontend/src/app/billing/BillingPageClient.tsx:753:                        {t("billing.currentPlan.title")}
frontend/src/app/billing/BillingPageClient.tsx:780:                  selectedPlan === 'pro'
frontend/src/app/billing/BillingPageClient.tsx:823:                        {t("billing.currentPlan.title")}
frontend/src/app/billing/BillingPageClient.tsx:869:                currentPlan={profile?.plan as PlanType || 'free'}
frontend/src/app/billing/BillingPageClient.tsx:871:                selectedPlan={selectedPlan}
frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:586:        currentPlan={userPlan}
frontend/src/components/Quotes/QuoteCardList.tsx:144:        currentPlan={userPlan}
frontend/src/components/PricingTable.tsx:30:  currentPlan?: PlanType;
frontend/src/components/PricingTable.tsx:32:  selectedPlan?: 'plus' | 'pro';
frontend/src/components/PricingTable.tsx:38:  currentPlan = 'free',
frontend/src/components/PricingTable.tsx:40:  selectedPlan = 'plus',
frontend/src/components/PricingTable.tsx:66:    if (currentPlan === plan) {
frontend/src/components/PricingTable.tsx:72:          {t('billing.currentPlan')}
frontend/src/components/PricingTable.tsx:77:    const isDowngrade = PLAN_HIERARCHY[plan] < PLAN_HIERARCHY[currentPlan];
frontend/src/components/PricingTable.tsx:94:          const isSelected = plan === selectedPlan;
frontend/src/components/PricingTable.tsx:141:                  selectedPlan === 'plus'
frontend/src/components/PricingTable.tsx:160:                  selectedPlan === 'pro'
frontend/src/components/PricingTable.tsx:187:                    selectedPlan === 'plus'
frontend/src/components/PricingTable.tsx:197:                    selectedPlan === 'pro'
frontend/src/components/PricingTable.tsx:217:                  selectedPlan === 'plus'
frontend/src/components/PricingTable.tsx:227:                  selectedPlan === 'pro'
frontend/src/components/Quotes/QuoteFinderPanel.tsx:390:      <PaywallModal isOpen={paywallOpen} onClose={() => setPaywallOpen(false)} reason={paywallReason} currentPlan={userPlan} />
frontend/src/components/Chat/ChatPanel.tsx:184:    currentPlan: userPlan,
frontend/src/components/Chat/ChatPanel.tsx:497:        currentPlan={userPlan}
frontend/src/components/PaywallModal.tsx:21:  currentPlan?: string;
frontend/src/components/PaywallModal.tsx:69:export function PaywallModal({ isOpen, onClose, reason, currentPlan }: PaywallModalProps) {
frontend/src/components/PaywallModal.tsx:73:  const targetPlan = deriveUpgradePlan(currentPlan, reason ?? null);
frontend/src/lib/errorCopy.ts:90:    href: billingHref({ plan, source: 'limit', reason }),
frontend/src/components/ModeSelector.tsx:24:      router.push(billingHref({ plan: 'plus', source: 'mode_selector', reason: `${modeId}_mode` }));
frontend/src/components/Extraction/ExtractionPanel.tsx:474:                    href={billingHref({ plan: "plus", source: "extraction_panel", reason: paywallCode.toLowerCase() })}
frontend/src/components/Extraction/ExtractionPanel.tsx:623:              href={billingHref({ plan: "plus", source: "tables_panel", reason: paywallCode.toLowerCase() })}
frontend/src/components/PaywallModal.tsx:151:            href={billingHref({ plan: targetPlan, source: 'paywall_modal', reason: copy.reason })}
frontend/src/components/Templates/QuestionTemplatesPanel.tsx:438:                    href={billingHref({ plan: upgradePlan, source: "question_templates", reason: paywall.code.toLowerCase() })}
frontend/src/components/Diff/DocumentDiffPanel.tsx:420:                href={billingHref({ plan: "pro", source: collectionId ? "collection_reader" : "compare_page", reason: "document_diff" })}
frontend/src/components/Diff/DocumentDiffPanel.tsx:668:                href={billingHref({ plan: "pro", source: collectionId ? "collection_reader" : "compare_page", reason: "document_diff" })}
frontend/src/components/Chat/ChatPanel.tsx:657:                router.push(billingHref({ plan: intent.plan, source: 'chat_plus_menu', reason: intent.reason }));
frontend/src/components/Chat/DomainModeSelector.tsx:39:      router.push(billingHref({ plan: 'plus', source: 'domain_mode_selector', reason: `${modeId}_domain_mode` }));
frontend/src/components/dashboard/DashboardPageClient.tsx:235:          href: billingHref({ plan: uploadUpgradePlan, source: 'limit', reason: 'file_size' }),
frontend/src/components/dashboard/DashboardPageClient.tsx:409:	                    href={billingHref({ plan: 'plus', source: 'dashboard_upgrade_reminder', reason: 'sustained_free_usage' })}
frontend/src/app/pricing/PricingPageContent.tsx:51:    ctaHref: billingHref({ plan: 'plus', source: 'pricing' }),
frontend/src/app/pricing/PricingPageContent.tsx:73:    ctaHref: billingHref({ plan: 'pro', source: 'pricing' }),
frontend/src/app/pricing/PricingPageContent.tsx:157:          href={billingHref({ plan: 'plus', source: 'pricing_hero' })}
frontend/src/app/features/layout-translation/LayoutTranslationPageContent.tsx:92:        primary={{ label: tOr('featuresLayoutTranslation.ctaButton', 'Upgrade to Plus'), href: billingHref({ plan: 'plus', source: 'features_layout_translation' }) }}
backend/app/models/tables.py:272:    plan: Mapped[str] = mapped_column(sa.String(20), nullable=False, server_default=sa.text("'free'"))
backend/app/models/tables.py:456:    from_plan: Mapped[str] = mapped_column(sa.String(16), nullable=False)
backend/app/models/tables.py:457:    to_plan: Mapped[str] = mapped_column(sa.String(16), nullable=False)
backend/app/models/tables.py:486:    plan: Mapped[Optional[str]] = mapped_column(sa.String(16), nullable=True)
backend/app/models/tables.py:525:    plan: Mapped[Optional[str]] = mapped_column(sa.String(16), nullable=True)
backend/app/api/billing.py:39:    plan: Literal["plus", "pro"] = "plus"
backend/app/api/billing.py:100:        return int(settings.PLAN_PRO_MONTHLY_CREDITS or 0)
backend/app/api/billing.py:102:        return int(settings.PLAN_PLUS_MONTHLY_CREDITS or 0)
backend/app/api/billing.py:103:    return int(settings.PLAN_FREE_MONTHLY_CREDITS or 0)
backend/app/api/billing.py:106:PLAN_HIERARCHY = {"free": 0, "plus": 1, "pro": 2}
backend/app/api/billing.py:445:    is_upgrade = PLAN_HIERARCHY.get(body.plan, 0) > PLAN_HIERARCHY.get(old_plan, 0)
backend/app/api/billing.py:1350:        is_upgrade = PLAN_HIERARCHY.get(detected_plan, 0) > PLAN_HIERARCHY.get(old_plan, 0)

exec
/bin/zsh -lc "nl -ba frontend/src/app/billing/BillingPageClient.tsx | sed -n '105,135p;270,315p;680,840p'
nl -ba frontend/src/components/PricingTable.tsx | sed -n '55,90p;130,175p;205,235p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
   105	  // focused element on open and restores it on close.
   106	  const confirmUpgradeRef = useRef<HTMLDivElement>(null);
   107	  const confirmDowngradeRef = useRef<HTMLDivElement>(null);
   108	  const confirmCancelRef = useRef<HTMLDivElement>(null);
   109	  useDialogFocusTrap(confirmUpgrade !== null, confirmUpgradeRef);
   110	  useDialogFocusTrap(confirmDowngrade !== null, confirmDowngradeRef);
   111	  useDialogFocusTrap(confirmCancel, confirmCancelRef);
   112	
   113	  useEffect(() => {
   114	    const planParam = searchParams.get("plan");
   115	    const periodParam = searchParams.get("period") || searchParams.get("billing");
   116	
   117	    if (planParam === "plus" || planParam === "pro") {
   118	      setSelectedPlan(planParam as BillingPlanIntent);
   119	    }
   120	    if (periodParam === "monthly" || periodParam === "annual") {
   121	      setBillingPeriod(periodParam as BillingPeriodIntent);
   122	    }
   123	    if (planParam === "plus" || planParam === "pro" || searchParams.get("source") || searchParams.get("reason")) {
   124	      trackEvent("billing_view", {
   125	        plan: planParam || "plus",
   126	        period: periodParam || "monthly",
   127	        source: searchParams.get("source"),
   128	        reason: searchParams.get("reason"),
   129	      });
   130	    }
   131	  }, [searchParams]);
   132	
   133	  useEffect(() => {
   134	    const isSuccess = searchParams.get("success");
   135	    const isCanceled = searchParams.get("canceled");
   270	    }
   271	    // Legacy: extract backend string detail for any billing.py endpoint
   272	    // that still returns `{ detail: "..." }` (scope-out in Phase 1).
   273	    const detailMatch = raw.match(/"detail"\s*:\s*"([^"]+)"/);
   274	    if (detailMatch) {
   275	      return detailMatch[1];
   276	    }
   277	    return t("billing.error");
   278	  };
   279	
   280	  const handlePlanAction = async (plan: PlanType) => {
   281	    if (submitting) return;
   282	    if (plan === 'free') return;
   283	    const currentPlan = (profile?.plan || 'free') as PlanType;
   284	
   285	    if (currentPlan === 'free') {
   286	      await handleSubscribe(plan);
   287	      return;
   288	    }
   289	
   290	    if (currentPlan === plan) {
   291	      return;
   292	    }
   293	
   294	    const isUpgrade = PLAN_HIERARCHY[plan] > PLAN_HIERARCHY[currentPlan];
   295	    if (isUpgrade) {
   296	      setConfirmUpgrade({ plan, billing: billingPeriod });
   297	    } else {
   298	      setConfirmDowngrade({ plan, billing: billingPeriod });
   299	    }
   300	  };
   301	
   302	  const confirmUpgradeAction = async () => {
   303	    if (!confirmUpgrade) return;
   304	    setSubmitting("confirm-upgrade");
   305	    try {
   306	      const result = await changePlan({
   307	        plan: confirmUpgrade.plan,
   308	        billing: confirmUpgrade.billing,
   309	      });
   310	      triggerCreditsRefresh();
   311	      await refetchProfile();
   312	      if (result.credits_supplemented > 0) {
   313	        setMessage(
   314	          t("billing.upgradeSuccess", {
   315	            credits: result.credits_supplemented.toLocaleString(),
   680	                  <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-5/6" />
   681	                  <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-4/5" />
   682	                </div>
   683	                <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded" />
   684	              </div>
   685	            ))}
   686	          </section>
   687	        ) : profileError ? (
   688	          <section className="mb-8 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
   689	            <p>{profileError}</p>
   690	            <button
   691	              onClick={() => void refetchProfile()}
   692	              className="mt-2 text-sm underline hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:rounded-sm"
   693	            >
   694	              {t("common.retry")}
   695	            </button>
   696	          </section>
   697	        ) : (
   698	          <>
   699	            {/* Subscription Cards */}
   700	            <section className="mb-8 grid md:grid-cols-2 gap-6">
   701	              {/* Plus Card */}
   702	              <div
   703	                onClick={() => setSelectedPlan('plus')}
   704	                className={`relative rounded-xl border p-0 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
   705	                  selectedPlan === 'plus'
   706	                    ? 'border-accent bg-white ring-1 ring-accent/20 dark:bg-zinc-900'
   707	                    : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
   708	                }`}
   709	              >
   710	                <div className="rounded-xl p-6 h-full flex flex-col">
   711	                  <div className="flex items-center gap-2 mb-1">
   712	                    <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t("billing.plus.title")}</h2>
   713	                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">
   714	                      {t("billing.mostPopular")}
   715	                    </span>
   716	                  </div>
   717	                  <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">{t("billing.plus.description")}</p>
   718	                  <div className="mb-4">
   719	                    <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
   720	                      {formatPlanPrice('plus', billingPeriod)}
   721	                    </span>
   722	                    <span className="text-zinc-500 dark:text-zinc-400 text-sm ml-1">
   723	                      {t('billing.perMonth')}
   724	                    </span>
   725	                    {billingPeriod === 'annual' && (
   726	                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
   727	                        {t('billing.savePercent', { percent: 20 })}
   728	                      </span>
   729	                    )}
   730	                  </div>
   731	                  <ul className="space-y-2 mb-6 flex-1">
   732	                    {plusFeatures.map((f, i) => (
   733	                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
   734	                        <Check aria-hidden="true" size={16} className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
   735	                        {f}
   736	                      </li>
   737	                    ))}
   738	                  </ul>
   739	                  {profile?.plan === 'plus' ? (
   740	                    profile?.billing_state?.managed_by === 'stripe' ? (
   741	                      <button
   742	                        onClick={handleManage}
   743	                        disabled={submitting !== null}
   744	                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
   745	                      >
   746	                        {t("billing.manage")}
   747	                      </button>
   748	                    ) : (
   749	                      <button
   750	                        disabled
   751	                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 cursor-not-allowed font-medium"
   752	                      >
   753	                        {t("billing.currentPlan.title")}
   754	                      </button>
   755	                    )
   756	                  ) : profile?.plan === 'pro' ? (
   757	                    <button
   758	                      onClick={() => handlePlanAction('plus')}
   759	                      disabled={submitting !== null}
   760	                      className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
   761	                    >
   762	                      {submitting === 'plus' ? t("common.loading") : `${t("billing.downgrade")} Plus`}
   763	                    </button>
   764	                  ) : (
   765	                    <button
   766	                      onClick={() => handlePlanAction('plus')}
   767	                      disabled={submitting !== null}
   768	                      className="w-full px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
   769	                    >
   770	                      {submitting === 'plus' ? t("common.loading") : `${t("billing.upgrade")} Plus`}
   771	                    </button>
   772	                  )}
   773	                </div>
   774	              </div>
   775	
   776	              {/* Pro Card */}
   777	              <div
   778	                onClick={() => setSelectedPlan('pro')}
   779	                className={`relative rounded-xl border p-0 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ${
   780	                  selectedPlan === 'pro'
   781	                    ? 'border-accent bg-white ring-1 ring-accent/20 dark:bg-zinc-900'
   782	                    : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
   783	                }`}
   784	              >
   785	                <div className="rounded-xl p-6 h-full flex flex-col">
   786	                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-1">{t("billing.pro.title")}</h2>
   787	                  <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4">{t("billing.pro.description")}</p>
   788	                  <div className="mb-4">
   789	                    <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">
   790	                      {formatPlanPrice('pro', billingPeriod)}
   791	                    </span>
   792	                    <span className="text-zinc-500 dark:text-zinc-400 text-sm ml-1">
   793	                      {t('billing.perMonth')}
   794	                    </span>
   795	                    {billingPeriod === 'annual' && (
   796	                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
   797	                        {t('billing.savePercent', { percent: 20 })}
   798	                      </span>
   799	                    )}
   800	                  </div>
   801	                  <ul className="space-y-2 mb-6 flex-1">
   802	                    {proFeatures.map((f, i) => (
   803	                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300">
   804	                        <Check size={16} className="text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
   805	                        {f}
   806	                      </li>
   807	                    ))}
   808	                  </ul>
   809	                  {profile?.plan === 'pro' ? (
   810	                    profile?.billing_state?.managed_by === 'stripe' ? (
   811	                      <button
   812	                        onClick={handleManage}
   813	                        disabled={submitting !== null}
   814	                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
   815	                      >
   816	                        {t("billing.manage")}
   817	                      </button>
   818	                    ) : (
   819	                      <button
   820	                        disabled
   821	                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 cursor-not-allowed font-medium"
   822	                      >
   823	                        {t("billing.currentPlan.title")}
   824	                      </button>
   825	                    )
   826	                  ) : profile?.plan === 'plus' ? (
   827	                    <button
   828	                      onClick={() => handlePlanAction('pro')}
   829	                      disabled={submitting !== null}
   830	                      className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
   831	                    >
   832	                      {submitting === 'pro' ? t("common.loading") : `${t("billing.upgrade")} Pro`}
   833	                    </button>
   834	                  ) : (
   835	                    <button
   836	                      onClick={() => handlePlanAction('pro')}
   837	                      disabled={submitting !== null}
   838	                      className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
   839	                    >
   840	                      {submitting === 'pro' ? t("common.loading") : `${t("billing.upgrade")} Pro`}
    55	          <X aria-label="Not included" size={18} className="text-zinc-300 dark:text-zinc-600 mx-auto" />
    56	          <span className="sr-only">Not included</span>
    57	        </span>
    58	      );
    59	    }
    60	    // Dotted values are existing i18n keys; literal plan limits remain raw strings.
    61	    const text = value.includes('.') ? t(value as any) : value;
    62	    return <span className="text-sm text-zinc-700 dark:text-zinc-300 tabular-nums">{text}</span>;
    63	  };
    64	
    65	  const renderCta = (plan: PlanType) => {
    66	    if (currentPlan === plan) {
    67	      return (
    68	        <button
    69	          disabled
    70	          className="w-full mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
    71	        >
    72	          {t('billing.currentPlan')}
    73	        </button>
    74	      );
    75	    }
    76	    if (plan === 'free') return null;
    77	    const isDowngrade = PLAN_HIERARCHY[plan] < PLAN_HIERARCHY[currentPlan];
    78	    return (
    79	      <button
    80	        onClick={() => onUpgrade?.(plan)}
    81	        disabled={submitting !== null}
    82	        className="w-full mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
    83	      >
    84	        {isDowngrade ? t('billing.downgrade') : t('billing.upgrade')} {plan === 'plus' ? 'Plus' : 'Pro'}
    85	      </button>
    86	    );
    87	  };
    88	
    89	  return (
    90	    <div className="w-full">
   130	          <thead>
   131	            <tr className="border-b border-zinc-200 dark:border-zinc-800">
   132	              <td className="text-left py-4 px-6 font-medium text-zinc-500 dark:text-zinc-400 w-[34%]">
   133	                {t('billing.comparison.feature')}
   134	              </td>
   135	              <th scope="col" className="text-center py-4 px-3 font-medium text-zinc-500 dark:text-zinc-400 w-[22%]">
   136	                {t('billing.comparison.free')}
   137	              </th>
   138	              <th
   139	                scope="col"
   140	                className={`text-center py-4 px-3 w-[22%] cursor-pointer ${
   141	                  selectedPlan === 'plus'
   142	                    ? 'border-x-2 border-t-2 border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/20'
   143	                    : 'border-x border-t border-zinc-200 dark:border-zinc-800'
   144	                }`}
   145	              >
   146	                <button
   147	                  type="button"
   148	                  onClick={() => onSelectPlan?.('plus')}
   149	                  className="flex w-full flex-col items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
   150	                >
   151	                  <ShimmerBadge>{t('billing.mostPopular')}</ShimmerBadge>
   152	                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
   153	                    {t('billing.comparison.plus')}
   154	                  </span>
   155	                </button>
   156	              </th>
   157	              <th
   158	                scope="col"
   159	                className={`text-center py-4 px-3 w-[22%] cursor-pointer ${
   160	                  selectedPlan === 'pro'
   161	                    ? 'border-x-2 border-t-2 border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/20'
   162	                    : 'font-semibold text-zinc-900 dark:text-zinc-50'
   163	                }`}
   164	              >
   165	                <button
   166	                  type="button"
   167	                  onClick={() => onSelectPlan?.('pro')}
   168	                  className="w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500"
   169	                >
   170	                  {t('billing.comparison.pro')}
   171	                </button>
   172	              </th>
   173	            </tr>
   174	          </thead>
   175	          <tbody>
   205	            ))}
   206	            {/* CTA row */}
   207	            <tr>
   208	              <th scope="row" className="py-4 px-6 text-left font-normal">
   209	                <span className="sr-only">Plan actions</span>
   210	              </th>
   211	              <td className="py-4 px-3 text-center">
   212	                {renderCta('free')}
   213	              </td>
   214	              <td
   215	                onClick={() => onSelectPlan?.('plus')}
   216	                className={`py-4 px-3 text-center cursor-pointer ${
   217	                  selectedPlan === 'plus'
   218	                    ? 'border-x-2 border-b-2 border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/20 rounded-b-xl'
   219	                    : 'border-x border-zinc-200 dark:border-zinc-800'
   220	                }`}
   221	              >
   222	                {renderCta('plus')}
   223	              </td>
   224	              <td
   225	                onClick={() => onSelectPlan?.('pro')}
   226	                className={`py-4 px-3 text-center cursor-pointer ${
   227	                  selectedPlan === 'pro'
   228	                    ? 'border-x-2 border-b-2 border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/20 rounded-b-xl'
   229	                    : ''
   230	                }`}
   231	              >
   232	                {renderCta('pro')}
   233	              </td>
   234	            </tr>
   235	          </tbody>

exec
/bin/zsh -lc "rg -n 'MAX_DOCUMENTS' backend/app/core/config.py backend/.env.example frontend/src | head -n 80
rg -n 'FREE_MAX_DOCUMENTS|PLUS_MAX_DOCUMENTS|PRO_MAX_DOCUMENTS' backend | head -n 80" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
rg: backend/.env.example: No such file or directory (os error 2)
backend/app/core/config.py:152:    FREE_MAX_DOCUMENTS: int = 3
backend/app/core/config.py:153:    PLUS_MAX_DOCUMENTS: int = 20
backend/app/core/config.py:154:    PRO_MAX_DOCUMENTS: int = 999
backend/app/core/config.py:202:    # FREE/PLUS/PRO_MAX_DOCUMENTS convention above), not the boolean-gate
backend/tests/test_error_taxonomy.py:160:    db = _make_db(scalar=AsyncMock(return_value=settings.FREE_MAX_DOCUMENTS))
backend/tests/test_error_taxonomy.py:178:    db = _make_db(scalar=AsyncMock(return_value=settings.FREE_MAX_DOCUMENTS))
backend/app/services/saved_quotes_service.py:39:    """Same dict-lookup convention as documents.py's FREE/PLUS/PRO_MAX_DOCUMENTS
backend/app/api/layout_translations.py:157:        "free": settings.FREE_MAX_DOCUMENTS,
backend/app/api/layout_translations.py:158:        "plus": settings.PLUS_MAX_DOCUMENTS,
backend/app/api/layout_translations.py:159:        "pro": settings.PRO_MAX_DOCUMENTS,
backend/app/api/layout_translations.py:160:    }.get(plan, settings.FREE_MAX_DOCUMENTS)
backend/app/core/config.py:152:    FREE_MAX_DOCUMENTS: int = 3
backend/app/core/config.py:153:    PLUS_MAX_DOCUMENTS: int = 20
backend/app/core/config.py:154:    PRO_MAX_DOCUMENTS: int = 999
backend/app/core/config.py:202:    # FREE/PLUS/PRO_MAX_DOCUMENTS convention above), not the boolean-gate
backend/app/api/documents.py:218:        "free": settings.FREE_MAX_DOCUMENTS,
backend/app/api/documents.py:219:        "plus": settings.PLUS_MAX_DOCUMENTS,
backend/app/api/documents.py:220:        "pro": settings.PRO_MAX_DOCUMENTS,
backend/app/api/documents.py:221:    }.get(plan, settings.FREE_MAX_DOCUMENTS)
backend/app/api/documents.py:352:        "free": settings.FREE_MAX_DOCUMENTS,
backend/app/api/documents.py:353:        "plus": settings.PLUS_MAX_DOCUMENTS,
backend/app/api/documents.py:354:        "pro": settings.PRO_MAX_DOCUMENTS,
backend/app/api/documents.py:355:    }.get(plan, settings.FREE_MAX_DOCUMENTS)

exec
/bin/zsh -lc "rg -n 'async def get_current_user_optional|def get_current_user_optional|async def require_auth|def require_auth' backend/app/core/deps.py
nl -ba backend/app/core/deps.py | sed -n '110,250p'
rg -n --glob '*.py' 'def verify_session_access|async def verify_session_access' backend/app/api/chat.py
nl -ba backend/app/api/chat.py | sed -n '120,330p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
24:async def get_current_user_optional(
67:async def require_auth(
167:async def verify_session_access(
   120	
   121	async def enforce_free_mode_limits(db: AsyncSession, user: User, mode: Optional[str]) -> None:
   122	    """Limit Free-plan access to higher-cost modes without adding a new table."""
   123	    if (user.plan or "free").lower() != "free":
   124	        return
   125	
   126	    effective_mode = mode if mode in settings.MODE_MODELS else "balanced"
   127	    # Internal "balanced" now maps to the visible Pro mode.
   128	    if effective_mode != "balanced":
   129	        return
   130	
   131	    configured_limit = (
   132	        settings.FREE_PRO_MONTHLY_LIMIT
   133	        if settings.FREE_PRO_MONTHLY_LIMIT is not None
   134	        else settings.FREE_BALANCED_MONTHLY_LIMIT
   135	    )
   136	    limit = int(configured_limit or 0)
   137	    if limit <= 0:
   138	        return
   139	
   140	    window_start = _as_utc(getattr(user, "monthly_credits_granted_at", None))
   141	    if window_start is None:
   142	        window_start = datetime.now(timezone.utc) - timedelta(days=30)
   143	
   144	    pro_model = settings.MODE_MODELS["balanced"]
   145	    used = await db.scalar(
   146	        select(func.count())
   147	        .select_from(UsageRecord)
   148	        .where(UsageRecord.user_id == user.id)
   149	        .where(UsageRecord.model == pro_model)
   150	        .where(UsageRecord.created_at >= window_start)
   151	    )
   152	    used_count = int(used or 0)
   153	    if used_count >= limit:
   154	        raise HTTPException(
   155	            status_code=402,
   156	            detail={
   157	                "error": "PRO_MODE_LIMIT_REACHED",
   158	                "message": "Free plan Pro mode limit reached",
   159	                "mode": "balanced",
   160	                "limit": limit,
   161	                "used": used_count,
   162	                "required_plan": "plus",
   163	            },
   164	        )
   165	
   166	
   167	async def verify_session_access(
   168	    session_id: uuid.UUID,
   169	    user: Optional[User],
   170	    db: AsyncSession,
   171	) -> Optional[ChatSession]:
   172	    """Verify user has access to the session. Returns session if authorized, None otherwise."""
   173	    result = await db.execute(
   174	        select(ChatSession)
   175	        .options(selectinload(ChatSession.document), selectinload(ChatSession.collection))
   176	        .where(ChatSession.id == session_id)
   177	    )
   178	    session = result.scalar_one_or_none()
   179	    if not session:
   180	        return None
   181	
   182	    # Demo document session ownership enforcement
   183	    if session.document and session.document.demo_slug:
   184	        if user is None:
   185	            # Anonymous can only access anonymous sessions
   186	            return session if session.user_id is None else None
   187	        # Authenticated user can only access their own demo sessions
   188	        return session if session.user_id == user.id else None
   189	
   190	    # Non-demo document access check
   191	    if session.document and not can_access_document(session.document, user):
   192	        return None
   193	
   194	    # If collection has an owner, verify the user matches
   195	    if session.collection_id is not None:
   196	        collection = session.collection or await db.get(Collection, session.collection_id)
   197	        if not collection:
   198	            return None
   199	        if collection.user_id and (not user or collection.user_id != user.id):
   200	            return None
   201	
   202	    return session
   203	
   204	
   205	async def verify_document_access(
   206	    document_id: uuid.UUID,
   207	    user: Optional[User],
   208	    db: AsyncSession,
   209	) -> Optional[Document]:
   210	    """Verify user has access to the document. Returns document if authorized, None otherwise."""
   211	    doc = await db.get(Document, document_id)
   212	    if not doc:
   213	        return None
   214	
   215	    return doc if can_access_document(doc, user) else None
   216	
   217	
   218	@chat_router.post(
   219	    "/documents/{document_id}/sessions",
   220	    status_code=status.HTTP_201_CREATED,
   221	    response_model=SessionCreateResponse,
   222	)
   223	async def create_session(
   224	    document_id: uuid.UUID,
   225	    request: Request,
   226	    user: Optional[User] = Depends(get_current_user_optional),
   227	    db: AsyncSession = Depends(get_db_session),
   228	):
   229	    # Verify document access
   230	    doc = await verify_document_access(document_id, user, db)
   231	    if not doc:
   232	        raise HTTPException(status_code=404, detail=DOCUMENT_NOT_FOUND_DETAIL)
   233	
   234	    # Limit free-plan users to N sessions per document
   235	    if user is not None and (user.plan or "free").lower() == "free" and not doc.demo_slug:
   236	        session_count_result = await db.execute(
   237	            select(func.count(ChatSession.id))
   238	            .where(ChatSession.document_id == document_id)
   239	        )
   240	        if session_count_result.scalar() >= settings.FREE_MAX_SESSIONS_PER_DOC:
   241	            raise HTTPException(
   242	                status_code=403,
   243	                detail={
   244	                    "error": "SESSION_LIMIT_REACHED",
   245	                    "message": "Free plan session limit reached. Upgrade for unlimited sessions.",
   246	                    "limit": settings.FREE_MAX_SESSIONS_PER_DOC,
   247	                    "plan": "free",
   248	                },
   249	            )
   250	
   251	    # Limit authenticated free-plan users' OWN session count on demo documents.
   252	    # Separate from the anon cap above (which now only counts user_id IS NULL
   253	    # rows) and from the non-demo free-plan cap above (which excludes demo
   254	    # docs via `not doc.demo_slug`): without this, an authed free account
   255	    # could create unlimited demo sessions, exempt from every guard.
   256	    if user is not None and (user.plan or "free").lower() == "free" and doc.demo_slug:
   257	        own_session_count = await db.execute(
   258	            select(func.count(ChatSession.id)).where(
   259	                ChatSession.document_id == document_id,
   260	                ChatSession.user_id == user.id,
   261	            )
   262	        )
   263	        if own_session_count.scalar() >= settings.FREE_MAX_SESSIONS_PER_DOC:
   264	            raise HTTPException(
   265	                status_code=403,
   266	                detail={
   267	                    "error": "SESSION_LIMIT_REACHED",
   268	                    "message": "Free plan session limit reached. Upgrade for unlimited sessions.",
   269	                    "limit": settings.FREE_MAX_SESSIONS_PER_DOC,
   270	                    "plan": "free",
   271	                },
   272	            )
   273	
   274	    # Limit anonymous users on demo documents
   275	    if user is None and doc.demo_slug:
   276	        # M2: Per-IP rate limit on demo session creation
   277	        client_ip = get_client_ip(request)
   278	        if not await demo_session_create_limiter.is_allowed(client_ip):
   279	            raise HTTPException(
   280	                status_code=429,
   281	                detail={
   282	                    "error": "DEMO_SESSION_RATE_LIMITED",
   283	                    "message": "Too many demo sessions created",
   284	                    "retry_after": 300,
   285	                },
   286	                headers={"Retry-After": "300"},
   287	            )
   288	        session_count = await db.execute(
   289	            select(func.count(ChatSession.id)).where(*_recent_demo_session_filter(document_id))
   290	        )
   291	        if session_count.scalar() >= DEMO_MAX_SESSIONS_PER_DOC:
   292	            raise HTTPException(
   293	                status_code=429,
   294	                detail={
   295	                    "error": "DEMO_SESSION_LIMIT_REACHED",
   296	                    "message": "Demo session limit reached",
   297	                    "limit": DEMO_MAX_SESSIONS_PER_DOC,
   298	                },
   299	            )
   300	
   301	    sess = ChatSession(document_id=document_id, user_id=user.id if user else None)
   302	    db.add(sess)
   303	    await db.commit()
   304	    await db.refresh(sess)
   305	
   306	    response = SessionResponse(
   307	        session_id=sess.id,
   308	        document_id=sess.document_id,
   309	        title=sess.title,
   310	        created_at=sess.created_at,
   311	    )
   312	
   313	    # For anonymous demo sessions, include used message count so frontend
   314	    # can display the correct remaining count across page refreshes
   315	    # (limit is per IP per document).
   316	    if user is None and doc.demo_slug:
   317	        client_ip = get_client_ip(request)
   318	        used = await demo_message_tracker.get_count(_demo_message_key(client_ip, doc.id))
   319	        return JSONResponse(
   320	            status_code=201,
   321	            content={**response.model_dump(mode="json"), "demo_messages_used": used},
   322	        )
   323	
   324	    return response
   325	
   326	
   327	@chat_router.get("/sessions/{session_id}/messages", response_model=SessionMessagesResponse)
   328	async def get_session_messages(
   329	    session_id: uuid.UUID,
   330	    request: Request,

codex
The gate itself still holds under the alternate paths: collection chat reaches the same route, tool-triggered extraction receives only the already-gated request value, continuation never reloads the persisted field, and the worker has no client-reachable retry/update endpoint. I found one concrete newly exposed dead-end in the document-limit CTAs and am validating whether it affects only Pro or also Plus/free.
exec
/bin/zsh -lc "git show ba8a141:frontend/src/lib/errorCopy.ts | nl -ba | sed -n '75,115p'
git show ba8a141:'frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx' | nl -ba | sed -n '285,310p'
git show ba8a141:frontend/src/components/Chat/ChatArtifactCard.tsx | nl -ba | sed -n '320,340p'
for key in 'errors.DOMAIN_MODE_REQUIRES_PLUS.title' 'errors.DOMAIN_MODE_REQUIRES_PLUS.body' 'extract.domainModeRequiresPlus' 'paywall.domainMode.title' 'paywall.domainMode.body' 'paywall.domainMode.cta'; do count="'$(rg -l -F "'"\\\""'$key'"\\\"\" frontend/src/i18n/locales/*.json | wc -l | tr -d ' '); printf '%s %s\\n' \""'$key" "$count"; done
for f in frontend/src/i18n/locales/*.json; do jq empty "$f" || exit 1; done
rg -n --glob '"'*.py' 'domain_mode\\s*:' backend/app
rg -n --glob '*.py' 'domain_mode\\s*=' backend/app/api backend/app/services | sort" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 106ms:
backend/app/api/chat.py:488:            domain_mode=body.domain_mode
backend/app/api/chat.py:690:            domain_mode=getattr(row, 'domain_mode', None),
backend/app/services/chat_service.py:1312:                domain_mode=domain_mode,
backend/app/services/chat_service.py:1593:                domain_mode=domain_mode,
backend/app/services/chat_service.py:1604:            domain_mode=domain_mode,
backend/app/services/chat_service.py:2041:            # domain_mode=None means Default (no extra rules), string means apply rules
backend/app/services/chat_service.py:2058:                session_obj.domain_mode = domain_mode
backend/app/services/chat_tool_executor.py:473:                domain_mode=domain_mode,
backend/app/services/extraction_service.py:541:            domain_mode = (job.input_scope or {}).get("domain_mode")

exec
/bin/zsh -lc "nl -ba frontend/src/lib/sse.ts | sed -n '1,80p;185,225p'
nl -ba frontend/src/lib/useChatStream.ts | sed -n '82,130p;173,210p'
git show 1fab067"'^:frontend/src/lib/errorCopy.ts | nl -ba | sed -n '"'1,22p;270,290p'
git show 1fab067:frontend/src/lib/errorCopy.ts | nl -ba | sed -n '1,22p;270,290p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
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
    23	type DonePayload = {
    24	  message_id: string;
    25	  can_continue?: boolean;
    26	  continuation_count?: number;
    27	  /** FIX3-B (Codex r3 #5): set when the strict quote trigger matched but a
    28	   * negation/metalinguistic token was ALSO present, so verified quote search
    29	   * was deliberately NOT auto-routed/billed. Only ever present on the main
    30	   * RAG-path `done` event (chat_service.py's action_planner.deterministic_plan
    31	   * gate) — continuation/tool-action/quote-search `done` events don't carry
    32	   * it, so these default to false/null there, which is the correct "no
    33	   * chip" outcome for those paths too. */
    34	  quote_finder_hint?: boolean;
    35	  quote_finder_topic?: string | null;
    36	};
    37	type ToolStatusPayload = { message: string };
    38	type AnswerRepairedPayload = { text: string; citations: Citation[]; verification?: unknown };
    39	
    40	async function _processSSEStream(
    41	  reader: ReadableStreamDefaultReader<Uint8Array>,
    42	  onToken: (p: TokenPayload) => void,
    43	  onCitation: (c: Citation) => void,
    44	  onError: (e: ErrorPayload) => void,
    45	  onDone: (d: DonePayload) => void,
    46	  onTruncated?: () => void,
    47	  onArtifact?: (artifact: ChatArtifact) => void,
    48	  onToolStatus?: (status: ToolStatusPayload) => void,
    49	  onAnswerRepaired?: (payload: AnswerRepairedPayload) => void,
    50	  onCitationsRefined?: (citations: Citation[]) => void,
    51	  signal?: AbortSignal,
    52	) {
    53	  const decoder = new TextDecoder('utf-8');
    54	  let buffer = '';
    55	  let receivedDone = false;
    56	  let receivedTerminalError = false;
    57	
    58	  try {
    59	    while (true) {
    60	      const { done, value } = await reader.read();
    61	      if (done) break;
    62	      buffer += decoder.decode(value, { stream: true });
    63	
    64	      let boundary: number;
    65	      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
    66	        const rawEvent = buffer.slice(0, boundary);
    67	        buffer = buffer.slice(boundary + 2);
    68	
    69	        const lines = rawEvent.split('\n');
    70	        let eventName = 'message';
    71	        let dataStr = '';
    72	        for (const line of lines) {
    73	          if (line.startsWith('event:')) {
    74	            eventName = line.replace('event:', '').trim();
    75	          } else if (line.startsWith('data:')) {
    76	            dataStr += line.replace('data:', '').trim();
    77	          }
    78	        }
    79	
    80	        if (!dataStr) continue;
   185	  onToolStatus?: (status: ToolStatusPayload) => void,
   186	  onAnswerRepaired?: (payload: AnswerRepairedPayload) => void,
   187	  onCitationsRefined?: (citations: Citation[]) => void,
   188	) {
   189	  const res = await fetch(`${PROXY_BASE}/api/sessions/${sessionId}/chat`, {
   190	    method: 'POST',
   191	    headers: { 'Content-Type': 'application/json' },
   192	    body: JSON.stringify({
   193	      message,
   194	      ...(mode ? { mode } : {}),
   195	      ...(locale ? { locale } : {}),
   196	      domain_mode: domainMode ?? null,
   197	    }),
   198	    signal,
   199	  });
   200	
   201	  if (!res.ok || !res.body) {
   202	    if (signal?.aborted) return;
   203	    const raw = await res.text().catch(() => '');
   204	    let code = 'http_error';
   205	    let message = `HTTP ${res.status}: ${raw}`;
   206	    try {
   207	      const parsed = JSON.parse(raw);
   208	      const d = parsed && typeof parsed === 'object' && 'detail' in parsed
   209	        ? (parsed as Record<string, unknown>).detail
   210	        : parsed;
   211	      if (d && typeof d === 'object') {
   212	        const detail = d as Record<string, unknown>;
   213	        if (typeof detail.error === 'string') code = detail.error;
   214	        if (typeof detail.message === 'string') message = detail.message;
   215	      }
   216	    } catch {
   217	      // leave http_error + raw message as fallback
   218	    }
   219	    onError({ code, message, status: res.status });
   220	    return;
   221	  }
   222	
   223	  const reader = res.body.getReader();
   224	  await _processSSEStream(reader, onToken, onCitation, onError, onDone, onTruncated, onArtifact, onToolStatus, onAnswerRepaired, onCitationsRefined, signal);
   225	}
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
   173	  const handleStreamError = useCallback((err: unknown) => {
   174	    flushPendingText();
   175	    setStreaming(false);
   176	    abortRef.current = null;
   177	
   178	    const { message, code, status } = getErrorMeta(err);
   179	
   180	    if (isAbortLikeError(err)) {
   181	      return;
   182	    }
   183	
   184	    if (
   185	      status === 402
   186	      || code === 'INSUFFICIENT_CREDITS'
   187	      || code === 'MODE_NOT_ALLOWED'
   188	      || code === 'PRO_MODE_LIMIT_REACHED'
   189	      || code === 'BALANCED_MODE_LIMIT_REACHED'
   190	      || code === 'DOMAIN_MODE_REQUIRES_PLUS'
   191	    ) {
   192	      const reason = code || 'paid_limit';
   193	      // I27: previously hardcoded `plan: 'plus'`, which falsely attributed
   194	      // every paywall event in the funnel to plus-upgrade intent regardless
   195	      // of what triggered it (e.g. a Plus user hitting the Pro cap was logged
   196	      // as a Plus-upgrade event). Derive the actual upgrade target from
   197	      // (currentPlan, reason) so the upgrade-funnel analytics aren't poisoned.
   198	      const upgradePlan = deriveUpgradePlan(currentPlan, reason);
   199	      trackEvent('limit_hit', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
   200	      trackEvent('paywall_opened', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
   201	      onShowPaywall(reason);
   202	      return;
   203	    }
   204	
   205	    if (status === 409 || code === 'DOCUMENT_PROCESSING') {
   206	      addMessage({
   207	        id: `m_${Date.now()}_proc`,
   208	        role: 'assistant',
   209	        text: t('doc.processing'),
   210	        createdAt: Date.now(),
     1	import type { ApiError } from './api';
     2	import { billingHref, type BillingPlanIntent } from './billingLinks';
     3	
     4	export interface ErrorCopy {
     5	  /** Short, one-line summary — suitable for toast title / inline heading. */
     6	  title: string;
     7	  /** Optional longer body with remediation detail + interpolated context. */
     8	  body: string;
     9	  /** Optional CTA button (e.g., upgrade or delete-docs link). */
    10	  cta?: { label: string; href: string };
    11	  severity: 'error' | 'warning' | 'info';
    12	  /**
    13	   * Whether the consumer should auto-open the paywall modal.
    14	   * Only true for 402 credit/mode paywalls and SSE MODE_NOT_ALLOWED
    15	   * (Codex r1 Q2: all other plan-limit 403s use inline CTA, never auto-modal).
    16	   */
    17	  openPaywall?: boolean;
    18	}
    19	
    20	type TFn = (key: string, params?: Record<string, string | number>) => string;
    21	type TOrFn = (key: string, fallback: string, params?: Record<string, string | number>) => string;
    22	
   270	  }),
   271	  MODE_NOT_ALLOWED: (_d, tOr) => ({
   272	    title: tOr('errors.MODE_NOT_ALLOWED.title', 'Plus plan required'),
   273	    body: tOr('errors.MODE_NOT_ALLOWED.body', 'This mode is available on the Plus plan.'),
   274	    cta: upgradeCta(tOr, 'mode_upgrade', 'plus'),
   275	    severity: 'warning',
   276	    openPaywall: true,
   277	  }),
   278	  DOMAIN_MODE_REQUIRES_PLUS: (d, tOr) => ({
   279	    title: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.title', 'Plus plan required'),
   280	    body: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.body', 'Legal and Academic domain mode is available on the Plus plan.'),
   281	    cta: requiredPlanCta(d, tOr, 'domain_mode'),
   282	    severity: 'warning',
   283	    openPaywall: true,
   284	  }),
   285	
   286	  // ─── Collections ───
   287	  COLLECTION_LIMIT_REACHED: (d, tOr) => ({
   288	    title: tOr('errors.COLLECTION_LIMIT_REACHED.title', 'Collection limit reached'),
   289	    body: tOr('errors.COLLECTION_LIMIT_REACHED.body', 'Your plan allows up to {limit} collections. Upgrade for more.', {
   290	      limit: String(d.limit ?? ''),
     1	import type { ApiError } from './api';
     2	import { billingHref, type BillingPlanIntent } from './billingLinks';
     3	
     4	export interface ErrorCopy {
     5	  /** Short, one-line summary — suitable for toast title / inline heading. */
     6	  title: string;
     7	  /** Optional longer body with remediation detail + interpolated context. */
     8	  body: string;
     9	  /** Optional CTA button (e.g., upgrade or delete-docs link). */
    10	  cta?: { label: string; href: string };
    11	  severity: 'error' | 'warning' | 'info';
    12	  /**
    13	   * Whether the consumer should auto-open the paywall modal.
    14	   * Only true for 402 credit/mode paywalls and SSE MODE_NOT_ALLOWED
    15	   * (Codex r1 Q2: all other plan-limit 403s use inline CTA, never auto-modal).
    16	   */
    17	  openPaywall?: boolean;
    18	}
    19	
    20	type TFn = (key: string, params?: Record<string, string | number>) => string;
    21	type TOrFn = (key: string, fallback: string, params?: Record<string, string | number>) => string;
    22	
   270	  }),
   271	  MODE_NOT_ALLOWED: (_d, tOr) => ({
   272	    title: tOr('errors.MODE_NOT_ALLOWED.title', 'Plus plan required'),
   273	    body: tOr('errors.MODE_NOT_ALLOWED.body', 'This mode is available on the Plus plan.'),
   274	    cta: upgradeCta(tOr, 'mode_upgrade', 'plus'),
   275	    severity: 'warning',
   276	    openPaywall: true,
   277	  }),
   278	  DOMAIN_MODE_REQUIRES_PLUS: (d, tOr) => ({
   279	    title: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.title', 'Plus plan required'),
   280	    body: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.body', 'Legal and Academic domain mode is available on the Plus plan.'),
   281	    cta: requiredPlanCta(d, tOr, 'domain_mode'),
   282	    severity: 'warning',
   283	  }),
   284	
   285	  // ─── Collections ───
   286	  COLLECTION_LIMIT_REACHED: (d, tOr) => ({
   287	    title: tOr('errors.COLLECTION_LIMIT_REACHED.title', 'Collection limit reached'),
   288	    body: tOr('errors.COLLECTION_LIMIT_REACHED.body', 'Your plan allows up to {limit} collections. Upgrade for more.', {
   289	      limit: String(d.limit ?? ''),
   290	    }),

Backend and frontend traces are complete. The gate is not bypassable through current request routes; remaining review items are a newly exposed Pro-plan CTA dead-end, the auto-modal invariant mismatch, and incomplete session-metadata clearing on early-return chat branches.
  ✓ Read scoped rules and enumerate the review range/changed files
  ✓ Trace backend domain_mode authorization, persistence, collection, and extraction retry paths
  ✓ Trace frontend SSE/REST error-code handling, paywall routing, markdown CTA safety, and i18n
  → Run focused adversarial checks and produce a severity-ranked verdict
exec
/bin/zsh -lc "git status --short
nl -ba frontend/src/lib/errorCopy.ts | sed -n '12,18p;80,112p;274,286p'
nl -ba frontend/src/lib/useChatStream.ts | sed -n '173,205p;235,265p'
nl -ba backend/app/services/chat_service.py | sed -n '1578,1602p;1665,1675p;1788,1800p;2038,2062p'
nl -ba backend/app/api/layout_translations.py | sed -n '155,183p;452,465p'
nl -ba frontend/src/app/billing/BillingPageClient.tsx | sed -n '113,125p;752,765p'" in /Users/mayijie/Projects/Code/010_DocTalk
 succeeded in 0ms:
?? .collab/reviews/2026-08-03-p1-hygiene-codex-r1.md
    12	  /**
    13	   * Whether the consumer should auto-open the paywall modal.
    14	   * Only true for 402 credit/mode paywalls and SSE MODE_NOT_ALLOWED
    15	   * (Codex r1 Q2: all other plan-limit 403s use inline CTA, never auto-modal).
    16	   */
    17	  openPaywall?: boolean;
    18	}
    80	
    81	type Handler = (detail: Record<string, unknown>, tOr: TOrFn) => ErrorCopy;
    82	
    83	function targetPlan(detail: Record<string, unknown>, fallback: BillingPlanIntent = 'plus'): BillingPlanIntent {
    84	  return detail.plan === 'plus' ? 'pro' : fallback;
    85	}
    86	
    87	function upgradeCta(tOr: TOrFn, reason: string, plan: BillingPlanIntent = 'plus') {
    88	  return {
    89	    label: tOr('errors.cta.upgrade', 'Upgrade'),
    90	    href: billingHref({ plan, source: 'limit', reason }),
    91	  };
    92	}
    93	
    94	function requiredPlanCta(detail: Record<string, unknown>, tOr: TOrFn, reason: string) {
    95	  const requiredPlan = detail.required_plan;
    96	  if (requiredPlan === 'plus' || requiredPlan === 'pro') {
    97	    return upgradeCta(tOr, reason, requiredPlan);
    98	  }
    99	  return undefined;
   100	}
   101	
   102	const CODE_TABLE: Record<string, Handler> = {
   103	  // ─── Upload ───
   104	  DOCUMENT_LIMIT_REACHED: (d, tOr) => ({
   105	    title: tOr('errors.DOCUMENT_LIMIT_REACHED.title', 'Document limit reached'),
   106	    body: tOr('errors.DOCUMENT_LIMIT_REACHED.body', 'You\'ve reached your plan\'s document limit ({limit}). Delete an old document or upgrade for more.', {
   107	      limit: String(d.limit ?? ''),
   108	    }),
   109	    cta: upgradeCta(tOr, 'document_limit', targetPlan(d)),
   110	    severity: 'warning',
   111	  }),
   112	  FILE_TOO_LARGE: (d, tOr) => ({
   274	    cta: upgradeCta(tOr, 'mode_upgrade', 'plus'),
   275	    severity: 'warning',
   276	    openPaywall: true,
   277	  }),
   278	  DOMAIN_MODE_REQUIRES_PLUS: (d, tOr) => ({
   279	    title: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.title', 'Plus plan required'),
   280	    body: tOr('errors.DOMAIN_MODE_REQUIRES_PLUS.body', 'Legal and Academic domain mode is available on the Plus plan.'),
   281	    cta: requiredPlanCta(d, tOr, 'domain_mode'),
   282	    severity: 'warning',
   283	  }),
   284	
   285	  // ─── Collections ───
   286	  COLLECTION_LIMIT_REACHED: (d, tOr) => ({
   173	  const handleStreamError = useCallback((err: unknown) => {
   174	    flushPendingText();
   175	    setStreaming(false);
   176	    abortRef.current = null;
   177	
   178	    const { message, code, status } = getErrorMeta(err);
   179	
   180	    if (isAbortLikeError(err)) {
   181	      return;
   182	    }
   183	
   184	    if (
   185	      status === 402
   186	      || code === 'INSUFFICIENT_CREDITS'
   187	      || code === 'MODE_NOT_ALLOWED'
   188	      || code === 'PRO_MODE_LIMIT_REACHED'
   189	      || code === 'BALANCED_MODE_LIMIT_REACHED'
   190	      || code === 'DOMAIN_MODE_REQUIRES_PLUS'
   191	    ) {
   192	      const reason = code || 'paid_limit';
   193	      // I27: previously hardcoded `plan: 'plus'`, which falsely attributed
   194	      // every paywall event in the funnel to plus-upgrade intent regardless
   195	      // of what triggered it (e.g. a Plus user hitting the Pro cap was logged
   196	      // as a Plus-upgrade event). Derive the actual upgrade target from
   197	      // (currentPlan, reason) so the upgrade-funnel analytics aren't poisoned.
   198	      const upgradePlan = deriveUpgradePlan(currentPlan, reason);
   199	      trackEvent('limit_hit', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
   200	      trackEvent('paywall_opened', { source: 'chat_stream', reason, plan: upgradePlan, period: 'monthly' });
   201	      onShowPaywall(reason);
   202	      return;
   203	    }
   204	
   205	    if (status === 409 || code === 'DOCUMENT_PROCESSING') {
   235	    const copy = errorCopy(err, t, tOr);
   236	    const state = useDocTalkStore.getState();
   237	    const currentMessages = state.messages;
   238	    const lastMessage = currentMessages[currentMessages.length - 1];
   239	    const lastAssistantIsEmpty = lastMessage?.role === 'assistant'
   240	      && !lastMessage.text
   241	      && !lastMessage.toolStatus
   242	      && (!lastMessage.citations || lastMessage.citations.length === 0)
   243	      && (!lastMessage.artifacts || lastMessage.artifacts.length === 0);
   244	
   245	    if (lastAssistantIsEmpty) {
   246	      state.setMessages([
   247	        ...currentMessages.slice(0, -1),
   248	        {
   249	          ...lastMessage,
   250	          text: copy.body,
   251	          isError: true,
   252	          isTruncated: false,
   253	        },
   254	      ]);
   255	      return;
   256	    }
   257	
   258	    addMessage({
   259	      id: `m_${Date.now()}_e`,
   260	      role: 'assistant',
   261	      text: copy.body,
   262	      isError: true,
   263	      createdAt: Date.now(),
   264	    });
   265	  }, [addMessage, flushPendingText, getErrorMeta, isAbortLikeError, onShowPaywall, setStreaming, t, tOr, currentPlan]);
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
  1665	            # than erroring. SAME predicate (`strict_quote_routed`, computed
  1666	            # above) already decided the predebit amount — never re-derive
  1667	            # this condition separately (FIX-3: that's exactly how a
  1668	            # quick-mode predebit could drift from what actually runs).
  1669	            if strict_quote_routed:
  1670	                setup_error_code = "QUOTE_SEARCH_ERROR"
  1671	                quote_progress = _VerifiedQuoteProgress()
  1672	                try:
  1673	                    outcome = await self._run_verified_quote_search(
  1674	                        session_id=session_id,
  1675	                        db=db,
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
   155	def _max_documents_for_plan(plan: str) -> int:
   156	    return {
   157	        "free": settings.FREE_MAX_DOCUMENTS,
   158	        "plus": settings.PLUS_MAX_DOCUMENTS,
   159	        "pro": settings.PRO_MAX_DOCUMENTS,
   160	    }.get(plan, settings.FREE_MAX_DOCUMENTS)
   161	
   162	
   163	async def _assert_document_capacity(user: User, db: AsyncSession) -> None:
   164	    plan = (user.plan or "free").lower()
   165	    current = await db.scalar(
   166	        select(func.count())
   167	        .select_from(Document)
   168	        .where(Document.user_id == user.id)
   169	        .where(Document.status != "deleting")
   170	    )
   171	    max_docs = _max_documents_for_plan(plan)
   172	    if int(current or 0) >= max_docs:
   173	        raise HTTPException(
   174	            status_code=403,
   175	            detail={
   176	                "error": "DOCUMENT_LIMIT_REACHED",
   177	                "message": "Document limit reached for current plan",
   178	                "limit": max_docs,
   179	                "current": int(current or 0),
   180	                "plan": plan,
   181	            },
   182	        )
   183	
   452	    storage_key = item.get("storage_key")
   453	    if not isinstance(storage_key, str) or not storage_key:
   454	        raise HTTPException(
   455	            status_code=404,
   456	            detail={"error": "LAYOUT_TRANSLATION_ARTIFACT_NOT_FOUND", "message": "Translated PDF not found"},
   457	        )
   458	
   459	    await _assert_document_capacity(user, db)
   460	    content = await asyncio.to_thread(storage_service.download_file, storage_key)
   461	    if not content.startswith(b"%PDF"):
   462	        raise HTTPException(
   463	            status_code=502,
   464	            detail={"error": "LAYOUT_TRANSLATION_INVALID_ARTIFACT", "message": "Translated PDF is invalid"},
   465	        )
   113	  useEffect(() => {
   114	    const planParam = searchParams.get("plan");
   115	    const periodParam = searchParams.get("period") || searchParams.get("billing");
   116	
   117	    if (planParam === "plus" || planParam === "pro") {
   118	      setSelectedPlan(planParam as BillingPlanIntent);
   119	    }
   120	    if (periodParam === "monthly" || periodParam === "annual") {
   121	      setBillingPeriod(periodParam as BillingPeriodIntent);
   122	    }
   123	    if (planParam === "plus" || planParam === "pro" || searchParams.get("source") || searchParams.get("reason")) {
   124	      trackEvent("billing_view", {
   125	        plan: planParam || "plus",
   752	                      >
   753	                        {t("billing.currentPlan.title")}
   754	                      </button>
   755	                    )
   756	                  ) : profile?.plan === 'pro' ? (
   757	                    <button
   758	                      onClick={() => handlePlanAction('plus')}
   759	                      disabled={submitting !== null}
   760	                      className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 shadow-sm hover:shadow-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
   761	                    >
   762	                      {submitting === 'plus' ? t("common.loading") : `${t("billing.downgrade")} Plus`}
   763	                    </button>
   764	                  ) : (
   765	                    <button

Adversarial review is complete. No current backend entitlement bypass was found, but two user-facing correctness issues require revision; one low-risk persistence invariant is also inaccurate.
  ✓ Read scoped rules and enumerate the review range/changed files
  ✓ Trace backend domain_mode authorization, persistence, collection, and extraction retry paths
  ✓ Trace frontend SSE/REST error-code handling, paywall routing, markdown CTA safety, and i18n
  ✓ Run focused adversarial checks and produce a severity-ranked verdict
codex
Overall verdict: **REVISE**. The backend entitlement gate is sound; I found no current free/anonymous bypass. One newly exposed paywall dead-end should be fixed before shipping.

### Findings

1. **P2 — Pro users at the document cap are sent to downgrade to Plus**

   [`targetPlan()`](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/errorCopy.ts:83) maps only `plan === "plus"` to Pro; every other plan—including `"pro"`—falls back to Plus. The two new layout-translation surfaces now render that CTA in [DocumentReaderPageClient.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:302) and [ChatArtifactCard.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/ChatArtifactCard.tsx:337).

   The backend can legitimately emit `DOCUMENT_LIMIT_REACHED` with `plan: "pro"` from [`_assert_document_capacity()`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/layout_translations.py:163). The resulting `/billing?plan=plus...` selects Plus, where a Pro user is explicitly offered “Downgrade Plus” in [BillingPageClient.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/billing/BillingPageClient.tsx:756).

   Free → Plus and Plus → Pro are correct. At Pro, suppress the upgrade CTA and link to document management/deletion instead.

2. **P3 — Removing `openPaywall` was locally correct, but the stated invariant is not true**

   The field is inert and removing it from the code-table entry was correct. However, the comment says non-402 plan-limit 403s never auto-open a modal in [errorCopy.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/errorCopy.ts:12), while `DOMAIN_MODE_REQUIRES_PLUS` is explicitly hard-coded into the auto-modal branch in [useChatStream.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:184).

   Under the current plumbing, chat actually depends on that exception: [sse.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/sse.ts:201) discards `required_plan`, and the generic chat error renderer outputs only `copy.body`, not `copy.cta`, in [useChatStream.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:245).

   Either document domain-mode 403 as an intentional auto-modal exception, or preserve error detail and render its CTA inline before removing the hard-coded trigger.

3. **P3 — “Omitted clears persisted session mode” is incomplete on successful early-return paths**

   Tool actions return at [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1586), and strict Quote Finder routing returns at [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1669), before session synchronization occurs at [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:2056). Thus an omitted mode does not always clear `ChatSession.domain_mode`.

   This is not a present entitlement bypass: downstream behavior uses the per-request argument, and continuation does not reload the persisted field. It does make the documented anti-replay invariant inaccurate and leaves hazardous stale metadata.

### Confirmed safe

- No bypass through ordinary chat, collection chat, chat-triggered extraction, continuation, or a client-reachable extraction retry/update route.
- Omitted/null mode does not over-gate free chat or extraction.
- Chat and REST extraction upgrade paths dispatch on `DOMAIN_MODE_REQUIRES_PLUS`, not merely HTTP 403/402.
- The share CTA markdown is constructed from trusted localized copy plus an internally generated `/billing` URL; no server-controlled markdown URL reaches it.
- All six new keys exist once in each of the 11 valid locale files, and their claims match the domain citation/prompt rules.
tokens used
188,798
Overall verdict: **REVISE**. The backend entitlement gate is sound; I found no current free/anonymous bypass. One newly exposed paywall dead-end should be fixed before shipping.

### Findings

1. **P2 — Pro users at the document cap are sent to downgrade to Plus**

   [`targetPlan()`](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/errorCopy.ts:83) maps only `plan === "plus"` to Pro; every other plan—including `"pro"`—falls back to Plus. The two new layout-translation surfaces now render that CTA in [DocumentReaderPageClient.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx:302) and [ChatArtifactCard.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/ChatArtifactCard.tsx:337).

   The backend can legitimately emit `DOCUMENT_LIMIT_REACHED` with `plan: "pro"` from [`_assert_document_capacity()`](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/layout_translations.py:163). The resulting `/billing?plan=plus...` selects Plus, where a Pro user is explicitly offered “Downgrade Plus” in [BillingPageClient.tsx](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/app/billing/BillingPageClient.tsx:756).

   Free → Plus and Plus → Pro are correct. At Pro, suppress the upgrade CTA and link to document management/deletion instead.

2. **P3 — Removing `openPaywall` was locally correct, but the stated invariant is not true**

   The field is inert and removing it from the code-table entry was correct. However, the comment says non-402 plan-limit 403s never auto-open a modal in [errorCopy.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/errorCopy.ts:12), while `DOMAIN_MODE_REQUIRES_PLUS` is explicitly hard-coded into the auto-modal branch in [useChatStream.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:184).

   Under the current plumbing, chat actually depends on that exception: [sse.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/sse.ts:201) discards `required_plan`, and the generic chat error renderer outputs only `copy.body`, not `copy.cta`, in [useChatStream.ts](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/useChatStream.ts:245).

   Either document domain-mode 403 as an intentional auto-modal exception, or preserve error detail and render its CTA inline before removing the hard-coded trigger.

3. **P3 — “Omitted clears persisted session mode” is incomplete on successful early-return paths**

   Tool actions return at [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1586), and strict Quote Finder routing returns at [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:1669), before session synchronization occurs at [chat_service.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py:2056). Thus an omitted mode does not always clear `ChatSession.domain_mode`.

   This is not a present entitlement bypass: downstream behavior uses the per-request argument, and continuation does not reload the persisted field. It does make the documented anti-replay invariant inaccurate and leaves hazardous stale metadata.

### Confirmed safe

- No bypass through ordinary chat, collection chat, chat-triggered extraction, continuation, or a client-reachable extraction retry/update route.
- Omitted/null mode does not over-gate free chat or extraction.
- Chat and REST extraction upgrade paths dispatch on `DOMAIN_MODE_REQUIRES_PLUS`, not merely HTTP 403/402.
- The share CTA markdown is constructed from trusted localized copy plus an internally generated `/billing` URL; no server-controlled markdown URL reaches it.
- All six new keys exist once in each of the 11 valid locale files, and their claims match the domain citation/prompt rules.
