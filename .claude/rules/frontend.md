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
- Free includes Flash plus a capped number of Pro answers/month. Export: Plus+ (frontend gated). Custom Instructions: Pro (backend gated). Sessions: Free=3/doc (backend gated). Saved quotes: Free=30 active across documents (backend gated; delete frees a slot). Quote searches cost credits like a Pro (balanced) chat message. Domain Mode (legal/academic chat overlay): Plus+ (backend gated, `chat.py`'s `chat_stream` — 403 `DOMAIN_MODE_REQUIRES_PLUS`).
- Credit packs: Boost(500/$3.99), Power(2K/$9.99), Ultra(5K/$19.99)
- Cancellation UI must remain self-serve. The cancel form may collect an optional reason, optional feedback, and a refund-review checkbox, but it must not block cancellation on those fields.
