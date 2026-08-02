# Wave: Frontend demo funnel fixes (B1, B2, B4) — Report

Implemented exactly per `wave-frontend-brief.md`, in order, one commit per task, plus one small self-review follow-up fix. All work on `main`.

## Commits

1. `25f8e8e` — `fix(demo): reuse anonymous demo session across page views via sessionStorage` (B1)
2. `0614e0e` — `feat(auth): optional callbackUrl override for the auth modal` (B2)
3. `f5850e5` — `feat(demo): locale URLs for /demo + truthful per-document cap copy` (B4)
4. `f627557` — `fix(demo): emit hreflang alternates on canonical /demo page` (self-review follow-up, see below)

## Task B1 — Anonymous demo session reuse

- `frontend/src/lib/useChatSession.ts`: added the re-adopt-from-`sessionStorage` branch at the top of the mount IIFE, exactly as specified — reads `dt-demo-session:${documentId}`, calls `getMessages`, adopts the session and returns early on success, clears the key and falls through on any error (stale/pruned/403/404).
- Added the `sessionStorage.setItem` write in the `createSession` success branch, gated on `s.demo_messages_used != null` (only true for anonymous demo sessions per backend contract — confirmed via `chat.py`: the field is only added when `session.user_id is None and session.document.demo_slug`).
- I nested the `sessionStorage.setItem` inside the existing `if (s.demo_messages_used != null) { setDemoMessagesUsed(...) }` block rather than adding a second sibling `if` with a duplicate condition — functionally identical to the brief's snippet, just avoids repeating the guard.
- `frontend/src/lib/api.ts`: `getMessages` return type now includes `demo_messages_used?: number | null`, populated from the raw response (backend omits the key entirely for authed/non-demo sessions, so it's `undefined` in that case, which the `!= null` checks treat the same as `null`).
- **Auth-safety verified**: authenticated users' `createSession` responses never carry `demo_messages_used`, so the write path never fires for them. If an authed user inherits a stale `sessionStorage` key from an earlier anonymous visit to the same demo doc, `getMessages` 404s (backend `verify_session_access`, chat.py:157-163, only returns an anon-owned session to `user is None` callers) — the `catch` clears the key and falls through to the normal `listSessions`/`createSession` flow. No behavior change for authenticated users. Documented this in a code comment above the new block.

## Task B2 — Auth-modal callback override

- `frontend/src/lib/auth-modal.ts`: added `callbackOverride` module-level state, `openAuthModal(options?: { callbackUrl?: string })` (backward-compatible — existing zero-arg call sites all still type-check), `peekAuthCallbackOverride()`, `clearAuthCallbackOverride()` — verbatim from the brief.
- `frontend/src/components/AuthModal.tsx`: `callbackUrl` IIFE now checks the override first; `clearAuthCallbackOverride()` called in `handleClose`.
- Confirmed all 5 existing `openAuthModal()` call sites (`DocumentReaderPageClient.tsx` ×2, `ChatPanel.tsx` ×3) still compile — none needed changes.
- **Did not touch `ChatPanel.tsx`** (including the `handleDemoAuthClick` CTA at line ~316-323) — brief Step 3 explicitly assigns that edit to the next wave since ChatPanel.tsx is owned by a later agent. Confirmed this by re-reading the brief text and the task-launch message before starting.

## Task B4 — Localize /demo + truthful cap copy

- Created `frontend/src/app/[locale]/demo/page.tsx` using `createMarketingLocalePage({ Content: DemoPageClient, path: '/demo', titleKey: 'demo.title', descKey: 'demo.subtitle' })` — verbatim from the brief. **No typing fight**: `DemoPageClient` (`() => JSX.Element`, no props) is directly assignable to `Content: (props: { locale: string }) => ...` under TS's normal function-parameter-count variance rules; no `as` cast needed.
- `frontend/src/i18n/routing.ts`: added `'/demo'` to `LOCALIZED_PATHS`.
- Localized `featuresDemo.whatYouGet.item1.label` in all 11 locale files (en/zh/ja/ko/es/de/fr/pt/it/ar/hi), each translated natively — I cross-referenced each file's existing "sample document" terminology (`demo.title` / `featuresDemo.docs.doc3.title`) to keep wording consistent with the rest of that locale's `featuresDemo` section, e.g. de → "5 Nachrichten pro Beispieldokument", zh → "每篇示例文档 5 条消息", ar → "5 رسائل لكل مستند عينة" (matches `featuresDemo.docs.doc3.title`'s "مستند عينة", not `demo.title`'s different phrasing).
- Fixed `frontend/src/app/features/free-demo/page.tsx:56` (JSON-LD `Offer.description`) per the brief, **and** also fixed a second stale claim at line 75 (JSON-LD `FAQPage` answer: "You get 5 messages per session with 3 sample documents") that the brief's Step 3 grep instruction ("verify no other stale claims... fix any remaining message-cap phrasing the same way") turned up — both now read "per sample document."
- Ran the broader grep across `src/` for `"per session"`/`"messages per"` patterns; the only other hit was an unrelated Italian string (`errors.SESSION_LIMIT_REACHED.body`, the *session-count* limit feature, not the demo message cap) — left untouched, out of scope.
- Validated all 11 edited locale JSON files parse (`python3 -c "import json; json.load(...)"` per file) — all OK, flat dotted keys preserved.

### Self-review follow-up (own commit `f627557`, not in the brief's file list)

While reviewing B4 for completeness I checked how every other page in `LOCALIZED_PATHS` wires hreflang: `buildMarketingMetadata()` only emits `alternates.languages` when the caller passes `localized: true` (`frontend/src/lib/seo.ts`). I confirmed every existing base-English page for a `LOCALIZED_PATHS` entry sets this (`app/page.tsx`, `app/trust/page.tsx`, `app/pricing/page.tsx`, `app/use-cases/lawyers/page.tsx` all have it). The brief's B4 file list did not include `frontend/src/app/demo/page.tsx`, and that file was missing `localized: true` — meaning the canonical English `/demo` page would not have advertised the new locale URLs via hreflang, even though `sitemap.ts` (which reads `LOCALIZED_PATHS` directly, independent of the metadata flag) would still list them. This is a one-line, low-risk fix consistent with the established pattern, so I made it and committed it separately rather than silently folding it into `f5850e5`.

## Verification evidence

Ran after every task and again at the end, from `frontend/`:
- `npx tsc --noEmit` — clean (no output) at every checkpoint, including after the final hreflang fix.
- `npx next lint --quiet` — `✔ No ESLint warnings or errors` at every checkpoint.
- `lsof -i :3000 -i :3001` — empty before starting (no dev server running), so no `.next/` corruption risk from any accidental build.
- Did **not** run `npm run build` — per the task instructions, that's reserved for the integration phase.
- All 11 locale JSON files individually validated with `python3 -m json.tool` equivalent (`json.load`) — all parse.

## Files changed (cumulative)

- `frontend/src/lib/useChatSession.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/auth-modal.ts`
- `frontend/src/components/AuthModal.tsx`
- `frontend/src/app/[locale]/demo/page.tsx` (new)
- `frontend/src/app/demo/page.tsx` (hreflang follow-up)
- `frontend/src/i18n/routing.ts`
- `frontend/src/i18n/locales/{en,de,es,fr,it,ja,ko,zh,ar,hi,pt}.json`
- `frontend/src/app/features/free-demo/page.tsx`

## Concerns / things the integration phase should double-check

1. **`npm run build` not yet run** — tsc/lint are clean but `next build` static-param generation for `/[locale]/demo` (and its interaction with `dynamicParams = false` in `[locale]/layout.tsx`) is unverified until the integration phase runs it. I did trace the layout — `generateStaticParams` return `URL_LOCALES.map(locale => ({ locale }))` generically, no per-page registration needed, matching every other `[locale]/<route>/page.tsx` in the tree — so I expect this to be fine, but it's untested by me.
2. **B2's CTA wiring is intentionally incomplete** — `openAuthModal({ callbackUrl: '/' })` is NOT wired into `ChatPanel.tsx`'s `handleDemoAuthClick` in this wave (brief explicitly assigns that to a later wave/agent). The new `openAuthModal` signature is ready for that wave to consume; nothing further needed from this side.
3. **`f627557` (hreflang fix) was not in the brief's file list** — flagging explicitly in case the integration/review step wants to scope-check it against the original plan. I judged it safely in-scope (same file family, one line, matches an established repo-wide pattern) rather than a scope change requiring a stop.
4. Did not verify the deployed FAQ copy change reads naturally end-to-end in the rendered `/features/free-demo` page (only checked the raw string) — worth a quick visual pass in the browser-driven QA stage the global constraints mention for UI changes, though this particular change is JSON-LD (not visibly rendered), so risk is low.

---

## Fix round 1 (review findings)

Commit `7a31bfe` — `fix(demo): review round 1 — session dropdown, SSR i18n, override lifecycle, fr copy`.

### IMPORTANT-1 — Session dropdown broke on the reuse path

Root cause confirmed exactly as diagnosed: `useChatSession.ts`'s reuse branch called `setSessions([])` while adopting a real, populated session, leaving `SessionDropdown` with an empty list (`sortedSessions.length === 0` → "New Chat"-only placeholder; `onDeleteSessionById`/`onSwitchSession` have nothing to target).

Fix: the reuse branch now calls `setSessions([...])` with a single `SessionItem` built from the fetched data — `session_id` = the stored id, `title: null`, `message_count: msgsData.messages.length`. `getMessages` doesn't return session-level `created_at`/`last_activity_at` (only per-message timestamps), so I derived them from the fetched messages themselves: `created_at` from the first message's `createdAt` (falls back to `new Date().toISOString()` if there are no messages yet), `last_activity_at` from the last message's `createdAt` (falls back to `created_at`). This is the same `SessionItem` shape `addSession` builds in the `createSession` branch, just populated from `getMessages` data instead of the `createSession` response.

### IMPORTANT-2 — `/[locale]/demo` wasn't SSR-translated

Confirmed the failure mode: `createMarketingLocalePage`'s `Page()` renders `<Content locale={params.locale} />` directly with no `LocaleProvider`. `DemoPageClient` is `"use client"` and reads all its copy via `useLocale()`, which is backed by `LocaleContext` — with no provider seeded for that locale, `useLocale()` falls back to whatever the *nearest ancestor* `LocaleProvider` is providing. The app doesn't appear to nest a plain unseeded `LocaleProvider` around every route by default in a way that would auto-detect `/de/` from the URL server-side — client detection (`detectLocale()` in `LocaleProvider.tsx:38-56`) only runs in a `useEffect`, i.e. after hydration. So the SSR HTML `DemoPageClient` renders is whatever the default/nearest provider's locale is at render time (English, absent an explicit seed) — exactly the crawler-invisibility bug the locale-URL program exists to fix, and exactly what `app/[locale]/page.tsx` solves for the landing page via an explicit `<LocaleProvider initialLocale={locale} initialMessages={messages}>` wrapper.

Fix: rewrote `app/[locale]/demo/page.tsx` to keep using `createMarketingLocalePage` (still get its `generateMetadata`/`notFound`/`MarketingArticleJsonLd` boilerplate for free) but swapped the `Content` prop from `DemoPageClient` directly to a small wrapper, `DemoContent`, that:
1. Re-guards `isUrlLocale(locale)` → `notFound()` (the factory's `Page()` already does this before calling `Content`, but `Content`'s own prop type is plain `string`, so this local guard is what lets TypeScript narrow `locale` to the `Locale` union without a cast — same mechanism `app/[locale]/page.tsx` uses, just applied inside the wrapper instead of inline in `Page()`).
2. Calls `getScopedMessages(locale, DEMO_PREFIXES)` — a new, tightly-scoped prefix list (`demo.`, `footer.`, `useCasesHub.breadcrumb.`, `common.`, `public.`, `auth.`, `header.`, `landing.`, `privacy.`, `terms.`).
3. Wraps `<DemoPageClient />` in `<LocaleProvider initialLocale={locale} initialMessages={messages}>`.

**Why that prefix list, and how I verified it's complete** (I can't run `npm run build`, so I traced the render tree by hand instead): I read `DemoPageClient.tsx` in full and collected every `t()`/`tOr()` key it calls directly — all under `demo.`, plus `footer.demo` and `useCasesHub.breadcrumb.home` for the breadcrumb, plus `common.retry`/`common.loading`. `DemoPageClient` renders `MarketingShell`, which renders `EditorialMarketingHeader` → `EditorialHeaderBase` and `EditorialFooter` — I read both and confirmed `MarketingShell` is called *without* a `chrome` prop in this tree (unlike `FreeDemoContent`, which passes a server-resolved `chrome` from `getChromeStrings`), so both header and footer fall back to their own `useLocale()` calls. I grepped every literal `t('...')`/`tOr('...')` in `EditorialHeaderBase.tsx` and `EditorialFooter.tsx` directly (not just what `ChromeStrings`/`getChromeStrings` covers, since a few keys — `header.aria.*`, `landing.masthead.tagline` — are read unconditionally regardless of whether a `chrome` prop is passed) and found: `public.nav.features`, `footer.pricing`, `footer.links.trust`, `auth.signIn`, `header.aria.*` (5 keys), `landing.masthead.tagline`, `header.aria.breadcrumb`, and the full `footer.*`/`privacy.policyLink`/`terms.title` set from `EditorialFooter`. Every one of those is covered by one of `public.`, `footer.`, `auth.`, `header.`, `landing.`, `privacy.`, `terms.` — which is why the final list has all of them. This mirrors (and is close to a superset of, minus the landing page's `hero.`/`chat.` which this tree doesn't use) the existing `LANDING_PREFIXES` in `app/[locale]/page.tsx`, for the identical reason: both wrap a client component tree that falls back to unseeded `useLocale()` for header/footer chrome.

Verification performed (again, no `npm run build`): `npx tsc --noEmit` is clean with the new file — specifically confirms the `isUrlLocale` narrowing lets `initialLocale={locale}` satisfy `LocaleProvider`'s `initialLocale?: Locale` prop without a cast, and confirms `getScopedMessages`'s return type (`Record<string, string>`) matches `initialMessages`. I did not spin up a dev server or run `next build` to visually confirm `/de/demo`'s SSR HTML string-matches German text — that's the one thing the integration phase should specifically check (e.g. `curl` the built output, or `view-source:` in a browser, and grep for a known German string like "Wählen Sie ein Beispieldokument" from `demo.title`).

### MINOR-3 — Override lifecycle gap

Fix: replaced the single `clearAuthCallbackOverride()` call in `handleClose` with a `useEffect` keyed on `isOpen`, gated by a `wasOpenRef` so it only fires on a genuine open→closed transition (not on initial mount, when `isOpen` starts `false` and no override could legitimately be pending yet). This covers `handleClose` (explicit `setIsOpen(false)`) and the `hashchange`/`syncFromHash` path (`isOpen` flips to `false` when the hash changes away from `#auth` for any reason, e.g. back-gesture) with one code path instead of two, per the "keep the primitive simple" note.

### MINOR-4 — French idiom collision

`fr.json`'s `featuresDemo.whatYouGet.item1.label` changed from "5 messages par exemple de document" to "5 messages par document d'exemple".

### Verification (fix round 1)

- `cd frontend && npx tsc --noEmit` — clean, run after each of the four fixes individually and once more at the end.
- `cd frontend && npx next lint --quiet` — `✔ No ESLint warnings or errors`, run at the end.
- `python3 -c "import json; json.load(open('src/i18n/locales/fr.json'))"` — parses.
- `lsof -i :3000 -i :3001` — empty, no dev server running.
- Confirmed Wave-2 already consumes the new `openAuthModal({ callbackUrl })` signature: `grep -n callbackUrl frontend/src/components/Chat/ChatPanel.tsx` → `openAuthModal({ callbackUrl: '/' })` at line 322, matching the controller's note that MINOR-3's "currently unreachable" premise no longer held.
- Did **not** run `npm run build` (still reserved for the integration phase) — see the IMPORTANT-2 section above for what specifically still needs a real build/browser check.

---

## Fix round 2 (live-integration defect)

Commit `aaeb334` — `fix(demo): review round 2 — reuse path double-counted demo message usage`.

### DEFECT — Demo counter double-counted on the reuse path

Confirmed the root cause exactly as diagnosed against `useChatStream.ts:72-78`. That hook computes `totalUsed = demoMessagesUsed + localUserMsgCount`, where `localUserMsgCount` is derived by counting `role === 'user'` entries in the live `messages` array. The implicit contract is that `demoMessagesUsed` holds only server-known usage **not already represented** in the local transcript — true on the `createSession` path, where `setMessages([])` starts the transcript empty, so the full server count belongs in `demoMessagesUsed` with nothing to double up against.

My reuse branch broke that contract: it calls `setMessages(msgsData.messages)` (restoring the real transcript, including its user messages) *and* `setDemoMessagesUsed(msgsData.demo_messages_used)` (the server's raw count) — so a session with 1 prior question showed `demoMessagesUsed = 1` stacked on top of `localUserMsgCount = 1`, i.e. `totalUsed = 2` instead of `1`.

Fix, scoped entirely to the reuse branch in `useChatSession.ts` (did not touch `useChatStream.ts`'s shared math, per the instruction):
- Compute `restoredUserMsgCount = msgsData.messages.filter(m => m.role === 'user').length` — the count already carried by the transcript I just restored.
- When the response has `demo_messages_used`: `setDemoMessagesUsed(Math.max(0, msgsData.demo_messages_used - restoredUserMsgCount))`, so `totalUsed` (server value) is not re-added on top of the same messages.
- When the response has no `demo_messages_used` field (non-demo/authed path — dead in practice for this branch since it 404s before reaching here, but kept for symmetry with the pre-existing `!= null` check): `setDemoMessagesUsed(0)`, since `localUserMsgCount` from the restored transcript already carries the full count on its own.
- Added a comment above the block stating the contract (`demoMessagesUsed` = server-known usage not already in the local transcript) so a future edit to this branch doesn't reintroduce the double-count.

### Verification (fix round 2)

- `cd frontend && npx tsc --noEmit` — clean.
- `cd frontend && npx next lint --quiet` — `✔ No ESLint warnings or errors`.
- Did not re-run the browser/Redis repro myself (no Redis/browser access from this environment) — the team lead is re-verifying the counter live in the browser after this commit, per their instruction.

---

## Codex r1 fixes (6 items, one commit each)

Triage doc: `.collab/dialogue/2026-08-02-p0-codex-r1-triage.md`. Commits:

1. `6149931` — FIX-2 (baseline demo-counter model)
2. `3dbbf5b` — FIX-3 (anon demo session pointer lifecycle)
3. `3296cc4` — FIX-5 (share-control honesty for anonymous users)
4. `5d5bec9` — FIX-9 (auth-modal callbackUrl origin validation)
5. `804da49` — FIX-10 (demo progress-bar aria-label)
6. `98df9e3` — FIX-11 (demo breadcrumb stays in-locale)

### FIX-2 — Baseline model replaces the round-2 subtraction model

The round-2 fix (`demoMessagesUsed = server - restored`) broke when the server's 24h Redis window expired or the IP changed: the restored transcript kept counting against a subtraction that could outlive the server's own window, hard-locking a user the backend would actually allow.

New contract: `totalUsed = demoMessagesUsed (server-known count AS OF THE LAST RESTORE/CREATE) + messages sent locally since then`.

- Store (`store/index.ts`) gains `demoRestoredUserMsgCount` — the baseline: how many of the transcript's user messages were already reflected in `demoMessagesUsed` at that restore/create point. `setDemoRestoredUserMsgCount` action added alongside.
- `useChatSession.ts`'s reuse branch: `demoMessagesUsed` reverts to the **raw** server value (`msgsData.demo_messages_used ?? 0`, no subtraction), and `demoRestoredUserMsgCount` is set to the restored transcript's user-message count.
- `useChatSession.ts`'s createSession branch and `SessionDropdown.tsx`'s `onNewChat`: baseline reset to `0` (fresh empty transcript, nothing restored yet).
- `store/index.ts`'s `clearDocumentTransientState()` (called by `useDocumentLoader` on every doc-switch route change) now also resets `demoMessagesUsed`/`demoRestoredUserMsgCount` to `0`, closing the transient stale-value window between a route change and `useChatSession`'s effect resolving doc B's real value.
- `useChatStream.ts`: `localUserMsgCount = Math.max(0, userMsgsInTranscript - demoRestoredUserMsgCount)`; `totalUsed = demoMessagesUsed + localUserMsgCount` (formula unchanged, only the inputs' meaning changed).
- Regenerate/continue: backend increments demo quota on both, but neither adds a local user message, so the UI would otherwise undercount. Added `bumpDemoUsageForRegenOrContinue()` — increments `demoMessagesUsed` by 1 optimistically (before the stream starts, same timing as `sendMessage`'s optimistic user-message add, no rollback on failure) — called from both `regenerateLastResponse` and `continueGenerating`, guarded on `maxUserMessages != null` so authenticated/non-demo sessions are untouched.

**Went beyond the literal fix list**: applied the identical baseline-reset contract to `SessionDropdown.tsx`'s `onSwitchSession` (not explicitly named in FIX-2's text). Reasoning: switching to an existing anon-demo session via the dropdown is also a "restore" of a transcript — without the same treatment, that flow would reintroduce the exact class of miscount FIX-2 exists to close, just triggered by a different UI path. Flagging this explicitly since it's an interpretation, not a literal instruction.

**Three sanity-check cases** (requested explicitly), walked through against the final formula:

1. **TTL expired**: server reports `demo_messages_used = 0` (Redis key gone), restored transcript has 5 prior user messages. `demoMessagesUsed = 0`, `demoRestoredUserMsgCount = 5`. At restore (nothing new sent): `userMsgsInTranscript = 5` → `localUserMsgCount = max(0, 5-5) = 0` → `totalUsed = 0 + 0 = 0`. UI shows "0 used" — matches the required outcome.
2. **Same-window revisit**: server reports `1`, restored transcript has 1 prior user message. `demoMessagesUsed = 1`, `demoRestoredUserMsgCount = 1`. `userMsgsInTranscript = 1` → `localUserMsgCount = max(0, 1-1) = 0` → `totalUsed = 1 + 0 = 1`. Matches "1 used" required outcome.
3. **New send after restore** (continuing case 2): user sends 1 new message → transcript now has 2 user messages. `userMsgsInTranscript = 2` → `localUserMsgCount = max(0, 2-1) = 1` → `totalUsed = 1(unchanged demoMessagesUsed) + 1(new) = 2`. Net +1, matches "+1 both sides" required outcome — `demoMessagesUsed` itself doesn't change on a normal send (only on regen/continue's explicit bump), but the baseline subtraction correctly isolates the one new message.

### FIX-3 — Anon demo session pointer lifecycle

New `frontend/src/lib/demoSessionStorage.ts`: `readDemoSession`/`writeDemoSession`/`clearDemoSession`, all try/catch-wrapped (storage-disabled environments → null/no-op, degrading to the create-per-view path rather than throwing).

- `useChatSession.ts` now uses the shared helpers. The reuse branch's catch block inspects the caught error: clears the pointer **only** when `e instanceof ApiError && (e.status === 404 || e.status === 403)` — a confirmed-gone/inaccessible session. Any other failure (network, 5xx) leaves the pointer in place; a retry or the createSession fallback below overwrites it on success anyway, so clearing unconditionally would burn a needless create on a session that's actually still fine.
- `SessionDropdown.tsx`'s `onNewChat` and `onSwitchSession` previously never wrote the pointer at all (only `useChatSession.ts`'s own createSession branch did) — traced both handlers per the instruction and added `writeDemoSession` calls to each, gated on `demo_messages_used != null` (anon-demo context confirmation), matching the reuse branch's baseline-reset addition from FIX-2.

### FIX-5 — Share-control honesty

New key `chat.shareSignIn` = "Sign in to share this conversation", translated natively across all 11 locales (cross-referenced each locale's existing `auth.signIn`/`demo.signInToContinue`/`chat.share` phrasing for consistent terminology, e.g. de "Anmelden, um diese Unterhaltung zu teilen", ja "この会話を共有するにはサインイン" mirroring the existing `demo.signInToContinue` sentence pattern).

- Composer share button (`ChatPanel.tsx`): `title`/`aria-label` now branch on `userPlan` between `chat.share` and `chat.shareSignIn`.
- Per-answer share button (`MessageBubble.tsx`): added a new `isAnonShareAnswer?: boolean` prop (threaded from `ChatPanel.tsx`'s `ChatMessageRow` → `ChatMessageRowProps`, set to `!userPlan` at the render call site) so the button knows which handler (`handleShareAnswerVoid` vs `handleAnonShareClick`) it's actually wired to, and swaps `title`/`aria-label` to `chat.shareSignIn` accordingly.

### FIX-9 — Auth-modal callbackUrl origin validation

`AuthModal.tsx`'s `callbackUrl` resolution now does `new URL(override, window.location.origin)` and uses the result only if `resolved.origin === window.location.origin`; a cross-origin or malformed override falls through to the current-page default (same as no override). Implemented exactly as specified — did not investigate whether the prior string-concatenation approach was independently exploitable end-to-end (it likely wasn't, since concatenating onto a fixed origin prefix can't itself produce a different origin), since the ask was explicitly framed as defense-in-depth for the primitive itself, independent of what Auth.js's own redirect callback may also validate downstream.

### FIX-10 — Progress-bar aria-label

New key `demo.questionsRemainingLabel` = "Questions remaining", translated natively across all 11 locales (derived from each locale's existing `demo.questionsRemaining` sentence, e.g. de "Verbleibende Fragen", zh "剩余问题数"). `ChatPanel.tsx`'s progressbar `aria-label` changed from `chat.messagesUsed` ("Messages used" — contradicted the bar's own visible text/fill direction, which describe remaining) to the new key. Left the old `chat.messagesUsed` key in place, unused, rather than deleting it — out of scope and not asked for.

### FIX-11 — Demo breadcrumb stays in-locale

`DemoPageClient.tsx`'s breadcrumb "Home" crumb hardcoded `href: '/'`. Now uses `localizedHrefIfAvailable(locale, '/')` (same helper `EditorialHeaderBase.tsx` uses for its nav links), with `locale` sourced from `useLocale()` as the fix explicitly pointed to. This is safe post the earlier IMPORTANT-2 SSR fix (`DemoPageClient` is now wrapped in a `LocaleProvider` seeded with the URL locale), so `useLocale()`'s `locale` is correct from first render — no client-detection lag risk that would make `usePathname()`-based derivation (what `EditorialHeaderBase` uses generically) necessary here specifically.

### Verification (Codex r1 fixes)

Ran after each individual fix and once more combined at the end, from `frontend/`:
- `npx tsc --noEmit` — clean at every checkpoint.
- `npx next lint --quiet` — `✔ No ESLint warnings or errors` at every checkpoint.
- All 11 locale JSON files individually validated with `python3 -c "import json; json.load(...)"` — all parse, after FIX-5 and again after FIX-10 (the two batches that touched locale files).
- Did not run `npm run build`, `npm test`, or a live browser/backend check — no dev server or backend was available in this environment for this round. The team lead's message didn't ask for it either (verification contract specified was `tsc` + `lint` + locale-parse only).

### Concerns / things a later phase should double-check

1. **FIX-2's `onSwitchSession` extension** (see above) is my own interpretation, not a literal instruction — worth a specific look in review.
2. **FIX-2's regen/continue bump timing** is optimistic (before the stream starts, no rollback on failure) to match `sendMessage`'s existing pattern — if a regenerate/continue call fails outright (e.g., network error before the backend even processes it), the counter would be off by one high. This mirrors a pre-existing characteristic of `sendMessage` itself (no rollback there either), so it's consistent behavior rather than a new gap, but flagging since it wasn't explicitly discussed.
3. **No live/browser verification possible in this environment** for any of the 6 fixes — particularly FIX-2's three sanity cases were verified algebraically (by hand-tracing the formula), not by exercising the actual UI/Redis. Worth a live pass alongside the counter re-verification the team lead is already doing for fix round 2.
4. `chat.messagesUsed` locale key (all 11 locales) is now unused (superseded by `demo.questionsRemainingLabel`) — left in place per usual practice of not removing keys not explicitly asked about.

---

## Codex r2 must-fix items (2 items, one commit each)

Review: `.collab/reviews/2026-08-02-p0-demo-retune-codex-r2.md` (§2, §3, "New breakage"). Commits:

1. `65046a5` — MUST-FIX-A (counter reset scope + regen/continue rollback)
2. `f594007` — MUST-FIX-B (transient-failure stop + delete-time pointer clear)

### MUST-FIX-A(a) — Counter reset scope

Root cause confirmed exactly as Codex described: `useDocumentLoader.ts`'s effect (`frontend/src/lib/useDocumentLoader.ts:46-163`) depends on `t`/`tOr`, which change identity on any locale switch (`LocaleProvider.tsx`'s `t`/`tOr` are `useCallback`s over `resolve`, which depends on `[locale, loadedTranslations]`). That effect calls `clearDocumentTransientState()` on every re-run — including a same-document language change, not just a document switch. My `6149931` commit had added `demoMessagesUsed`/`demoRestoredUserMsgCount` to that function's reset object, so a language change zeroed both fields while `useChatSession`'s effect (no locale in its deps) stayed dormant — nothing re-synced them afterward, leaving the counter at 0/0 with the transcript still showing old messages, i.e. exactly the TTL-hard-lock symptom (just triggered by a locale switch instead of by an actual TTL expiry).

Fix: reverted the `clearDocumentTransientState` part of `6149931` in `store/index.ts` (removed both fields from that reset object, restored the original doc comment), and added the reset directly inside `useChatSession`'s own effect instead — right after `setSessionError(null)`, before the async body starts. That effect's dependency array (`useChatSession.ts:165`) has no `t`/`tOr`/locale — I double-checked it only re-runs on `documentId`/`documentStatus` (plus the store setters, which are stable references) — so a language change cannot trigger this reset. And critically, whenever this effect DOES run, the reset and the adopt-or-create call that re-establishes server truth happen in the same synchronous execution, so there's no window where the counter sits at a stale reset value without a follow-up correction in flight.

**Confirmed no other reader needs the old reset location**: grepped every reference to `demoMessagesUsed`/`demoRestoredUserMsgCount` across `frontend/src` — the only readers are `useChatStream.ts` (the `totalUsed` formula) and the writers I already control (`useChatSession.ts`, `SessionDropdown.tsx`). Nothing else depended on `clearDocumentTransientState` zeroing them.

### MUST-FIX-A(b) — Regen/continue rollback

Chose **rollback over deferred-bump** (the report explains why, repeating here since the team lead asked me to state which and why): the ambiguity Codex identified — the frontend can't know for certain whether the backend's `demo_message_tracker.check_and_increment` ran before or after whatever caused a given request to fail — exists under EITHER approach. Deferring the bump to "first successful stream event" doesn't remove that ambiguity, it just moves where you have to guess (is the first SSE byte proof the backend already charged, or could a chargeable step still be pending?); it also would have required threading a new per-call flag through `streamAssistantResponse` (shared with `sendMessage`, which must NOT get this behavior) and separately through `continueGenerating`'s inline `continueStream` call, since `continueGenerating` doesn't go through `streamAssistantResponse` at all. Rollback is a smaller, self-contained change: a `preBumpDemoUsedRef` records the pre-bump value when `bumpDemoUsageForRegenOrContinue` fires; `handleStreamDone` clears it without restoring (stream completed, bump stands); `handleStreamError` restores it on any non-abort failure, then clears it, before its existing branching logic runs. An explicit user abort is excluded from the restore — the backend can only be mid-response by the time an abort is possible, so it plausibly already charged; rolling back there would risk UNDER-counting instead. Either way, any residual drift is bounded and self-corrects on the next restore (which always re-syncs `demoMessagesUsed` to the server's raw count) — same self-healing property the whole baseline model relies on.

### MUST-FIX-B(a) — Stop on transient adoption failure

Per the instruction, verified what the reader actually shows and that reload retries, rather than assuming:
- `DocumentReaderPageClient.tsx:79-81` reads `sessionError` from `useChatSession` and maps it through `errorCopy(sessionError, t, tOr)`.
- `errorCopy.ts`'s fallback (no matching `code`/`status` handler — which is what a generic network failure or an unmapped 5xx hits) returns `errors.NETWORK.title` = "Connection issue" / `errors.NETWORK.body` = "Something went wrong. Please check your connection and try again.", `severity: 'error'`, no CTA. 502/503 have their own slightly more specific handlers (`errorCopy.ts:450,455`) but same shape.
- `DocumentReaderPageClient.tsx:368-393` renders that title/body in a card in place of the chat panel when `sessionErrorCopy` is set — so the user sees an explicit, actionable message telling them to retry, not a silent failure or broken UI.
- Reload retries correctly: a full page reload remounts `useChatSession`, whose effect runs from the top — `setSessionError(null)` clears the prior error, `readDemoSession(documentId)` reads the SAME pointer (never cleared for a transient failure), and `getMessages(storedDemoSession)` is retried. If the transient issue resolved, this succeeds and adopts normally.

### MUST-FIX-B(b) — Delete-time pointer clear

`SessionDropdown.onDeleteSessionById` now checks `readDemoSession(documentId) === targetId` immediately after `deleteSession(targetId)` confirms, and calls `clearDemoSession(documentId)` right there — before `onSwitchSession`/`onNewChat` (the "replacement GET") runs at all.

## Codex's two repros, walked step by step against the new code

### Repro 1 — language change after a TTL-expired restore (MUST-FIX-A)

1. User has a 5-question demo transcript from >24h ago; Redis's window has expired, so the server-side count is genuinely `0`.
2. Page loads `/d/{doc}`. `useChatSession`'s effect fires (real `documentId` transition from `undefined`/other doc): resets `demoMessagesUsed=0`, `demoRestoredUserMsgCount=0` synchronously, then `readDemoSession` finds the stored pointer, `getMessages` returns the 5-message transcript with `demo_messages_used: 0` (server truth). Sets `demoMessagesUsed=0` (raw server value), `demoRestoredUserMsgCount=5` (the restored transcript's own user-message count). `useChatStream`'s formula: `userMsgsInTranscript(5) - demoRestoredUserMsgCount(5) = 0` local, `totalUsed = 0 + 0 = 0`. UI shows **5/5 remaining** — correct.
3. User switches the UI language (e.g. English → German) via the language selector. This changes `locale`, which changes `t`/`tOr`'s identity in `LocaleProvider`.
4. `useDocumentLoader`'s effect re-runs (its deps include `t`/`tOr`) — calls `clearDocumentTransientState()`. **This function no longer touches `demoMessagesUsed`/`demoRestoredUserMsgCount` at all** (reverted). It still resets search/highlights/summary/etc., which is the behavior it's meant for.
5. `useChatSession`'s effect does **not** re-run — its deps (`documentId`, `documentStatus`, stable store setters) are all unchanged by the language switch. `demoMessagesUsed`/`demoRestoredUserMsgCount` are therefore left exactly as step 2 set them: `0` and `5`.
6. UI still shows **5/5 remaining** after the language change — matches the correct pre-switch state, no hard-lock. (Compare to the r1 regression: previously this step would have zeroed both fields via `clearDocumentTransientState`, computing `totalUsed = 0 + max(0, 5-0) = 5`, showing 0/5 remaining — the bug is gone.)

### Repro 2 — delete B, then a transient failure switching to A (MUST-FIX-B)

1. Stored pointer names session B (current/active); session A also exists (surviving, in the in-memory `sessions` list).
2. User deletes B via the dropdown. `deleteSession(B)` succeeds (confirmed delete). `removeSession(B)` updates the in-memory list.
3. **New step**: `onDeleteSessionById` checks `readDemoSession(documentId) === 'B'` — true — and calls `clearDemoSession(documentId)` immediately. The pointer is now empty, before any replacement GET has even started.
4. `targetId (B) === sessionId` (B was active), `remaining.length > 0` (A survives) → calls `onSwitchSession('A')`.
5. `onSwitchSession` sets `sessionId='A'`, clears `messages`, then calls `getMessages('A')` — which fails transiently (network blip).
6. Because the exception is unhandled inside `onSwitchSession` (pre-existing, out of this fix's scope — not what Codex's repro is about), it propagates up uncaught from `onDeleteSessionById`. The pointer, however, is **already cleared** from step 3 — it does NOT name the deleted B, and it was never written to A either (since `onSwitchSession` never reached its `writeDemoSession` call, which only fires after a successful `getMessages`).
7. Next page load: `useChatSession`'s effect runs, `readDemoSession(documentId)` returns `null` (nothing stored) — falls straight to `listSessions`/`createSession`, exactly the same as a first-time anonymous visit. No 404 against a stale pointer, no reference to the deleted B, and A is simply not auto-resumed (the user would need to pick it from the dropdown again, same as any first-visit UX) — but nothing is broken or stuck. Compare to the r1/r2-repro state: previously the stored key kept naming deleted B, so the next load would 404 against B, clear it (correctly, since MUST-FIX-B(a)'s predecessor already handled the 404 case), and then also fall to `listSessions`/`createSession` — so the WORST case is now no worse, and the common case (successful switch to A) writes A's pointer immediately as before.

## Verification (Codex r2 must-fix items)

- `cd frontend && npx tsc --noEmit` — clean, checked after the combined edit and again after splitting the two commits.
- `cd frontend && npx next lint --quiet` — `✔ No ESLint warnings or errors`.
- Split `useChatSession.ts`'s two independent hunks (reset-placement vs. transient-failure-stop) across the two commits via `git add -p`, verified via `git diff --cached` that each commit contains exactly its intended hunk — confirmed the file's other, unrelated content wasn't accidentally split or duplicated.
- Did not run a live browser/Redis session — no dev server or backend available in this environment. The two repro walk-throughs above are traced against the actual committed code paths and line numbers, not executed live; the team lead is live-verifying the language-change case in the browser per their message.

### Concerns

1. **`onSwitchSession`'s unhandled `getMessages` rejection** (repro 2, step 6) is pre-existing and out of scope for this fix — Codex's repro happens to route through it, but the fix (clearing the pointer before the replacement GET) makes the pointer's end state correct regardless of whether that rejection is ever separately hardened. Flagging in case a future round wants to add a try/catch there for its own sake (e.g. to show a `sessionErrorCopy` message instead of a silent console error).
2. As before, no live verification was possible in this environment for either must-fix item.

---

## Codex r3 (2 items, one commit each)

Review: `.collab/reviews/2026-08-02-p0-demo-retune-codex-r3.md`. Commits:

1. `2b85cef` — COMMIT-1 (replace regen/continue rollback with authoritative re-anchor)
2. `fc02b86` — COMMIT-2 (adoption state dominates rendering, not just the counter)

r3 scoped its review to r2 must-fix #2 and #3 plus regressions in `65046a5`/`f594007`. It confirmed the document-reset half of #2 and the delete-pointer half of #3 as addressed, and found three new IMPORTANT problems, all traced to the ref-based rollback design and the early-return's interaction with render precedence.

### COMMIT-1 — replace ref-rollback with authoritative re-anchor

Deleted `preBumpDemoUsedRef` and all rollback logic from `65046a5`. `handleStreamError`/`handleStreamDone` are back to their pre-r2 shape (only the abort check was factored into a small shared `isAbortLikeError` helper, since the new catch blocks below need the identical check). `bumpDemoUsageForRegenOrContinue` is back to a plain unconditional +1 — kept exactly as instructed, since it's correct whenever the server actually charges (the dominant case, including abort).

Added `reanchorDemoCounter(sessionId)` in `useChatStream.ts`: a fire-and-forget `getMessages(sessionId)` that, when the response carries `demo_messages_used`, sets `demoMessagesUsed` to that raw value and `demoRestoredUserMsgCount` to the **current live transcript's** user-message count (not the fetched transcript's — the live one already reflects anything sent since, so this converges immediately without a page reload). Errors from the GET itself are swallowed (`.catch(() => {})`) — this is a best-effort correction, not something that should ever surface to the user.

**Wiring it into "every terminal failure path of regenerate/continue" required two distinct mechanisms**, because `chatStream`/`continueStream` have two genuinely different failure shapes (I traced `sse.ts` to confirm this rather than assume it):
- Non-ok HTTP responses (402/404/429/etc.), SSE `error` events, and mid-stream read errors are all reported via the `onError` **callback** and the outer promise still **resolves normally** — a try/catch around the await would never see these.
- Only the initial `fetch()` call itself failing outright (pure network failure, or an abort that happens before the response starts) causes the outer promise to **reject** — this is the ONE case a try/catch around the await does see.

So: `streamAssistantResponse` gained an optional `onErrorOverride` parameter (defaults to the shared `handleStreamError`, so `sendMessage`'s call site — which doesn't pass one — is byte-for-byte unchanged). `regenerateLastResponse` passes an override that calls `reanchorDemoCounter(sessionId)` then delegates to `handleStreamError`, covering the callback-shaped failures. `continueGenerating`'s inline `continueStream` call gets the identical inline wrapped callback (it never went through `streamAssistantResponse` to begin with). Both `regenerateLastResponse` and `continueGenerating` additionally wrap their whole awaited call in try/catch, calling `reanchorDemoCounter` (skipped via `isAbortLikeError` for a genuine abort) before **re-throwing the exact same error** — I deliberately did not change what happens to that error afterward (today it's an unhandled rejection either way, since `ChatPanel.tsx` calls both via `void regenerateLastResponse()`/`void continueGenerating()` with no `.catch`; my try/catch doesn't swallow or alter that, it only adds the re-anchor side effect before letting the same rejection through).

This design has **no persistent token of any kind** — the wrapped callbacks are fresh closures created on each call, not a ref that could survive across an aborted call into an unrelated later one (r3 breakage 2's root cause). And it never has to guess whether a given failure means the server charged — it just asks the server directly (r3 breakage 1's root cause: the continuation endpoint charging quota before validating continuability made "roll back on every non-abort error" provably wrong).

### COMMIT-2 — adoption state dominates rendering

Root cause confirmed exactly as r3 described: `f594007`'s transient-failure early return reset nothing except (after `65046a5`) the demo counter — `sessionId`/`messages`/`sessions` from the PREVIOUS document were left exactly as they were, since `clearDocumentTransientState` deliberately preserves them (by design, for reasons unrelated to this bug) and nothing else in `useChatSession` cleared them on a plain re-run. `DocumentReaderPageClient.tsx:366` checks `documentStatus === 'ready' && sessionId` **before** `sessionErrorCopy`, so with A's `sessionId` still truthy, a transient failure adopting B's session rendered A's stale `ChatPanel` instead of B's retryable error — silently keeping the user on A's chat while believing they were on B.

Fix: `useChatSession`'s effect now also calls `setSessionId(null)`, `setMessages([])`, `setSessions([])` synchronously at the top, alongside the existing demo-counter reset, before any async adoption work starts. Required widening the store's `setSessionId` action type from `(id: string) => void` to `(id: string | null) => void` (the state field itself was already `string | null`; only the setter was overly narrow).

**Verified against `DocumentReaderPageClient.tsx:366-393`** rather than assuming: with `sessionId` now `null`, `documentStatus === 'ready' && sessionId` evaluates to `true && null` → falsy regardless of `documentStatus`, so the ternary falls to the next branch — `sessionErrorCopy ? <error/> : ...`. Once the transient-failure path sets `sessionError` (already true before this commit, from `f594007`), that branch renders the retryable error card correctly. Before `sessionError` is set (i.e., during the async adoption attempt itself, or on the happy path before a fresh session lands), the chain falls through one more level to `documentStatus !== 'ready' && !error` (false, since `documentStatus` IS `'ready'` by the time this effect runs) and finally to the last `else` — a benign `{t('doc.initChat')}` placeholder div, not a blank or broken render.

### Codex's three breakages, walked step by step against the new code

**Breakage 1 — broad rollback undercounts a server-charged failure (continuation-charges-before-validation case).**
1. User has an active demo session; the last assistant message is truncated (`isTruncated: true`), so "Continue" is available.
2. User clicks Continue. `bumpDemoUsageForRegenOrContinue()` fires: `demoMessagesUsed` optimistically +1 (say 1→2).
3. `continueGenerating` calls `continueStream(...)` with the wrapped `onError`. The backend's continuation endpoint increments its own quota tracker, THEN discovers the message is no longer continuable (e.g., a stale `message_id` from a race) and returns 400 `CONTINUATION_LIMIT` (or 404 `MESSAGE_NOT_FOUND`) — quota WAS charged server-side.
4. `sse.ts` reports this as an `onError` callback (HTTP non-ok response) — the wrapped callback fires: `reanchorDemoCounter(sessionId)` is scheduled, THEN `handleStreamError(err)` runs its normal branching (shows the appropriate error copy to the user).
5. `reanchorDemoCounter`'s `getMessages(sessionId)` resolves with the server's now-current `demo_messages_used` (which reflects the charge — say the server also shows 2, matching what the optimistic bump already produced, OR whatever the true value is if other factors also changed it). `demoMessagesUsed` is set to that raw value; `demoRestoredUserMsgCount` is set to the current live transcript's user-message count.
6. Result: the counter converges to server truth directly from the source of truth, not from a client-side guess about whether this specific error code implies a charge or not. There is no rollback to get wrong.

**Breakage 2 — a stale rollback token undoes a later unrelated send's usage.**
1. User clicks Regenerate. `bumpDemoUsageForRegenOrContinue()` fires (demoMessagesUsed +1). User then clicks Stop before the stream resolves.
2. `stopStreaming()` aborts the controller. Per `sse.ts`, `_processSSEStream`'s catch checks `signal?.aborted` and returns silently — no `onError`, no `onDone`. `chatStream`'s `await` in `streamAssistantResponse` resolves normally (no throw, since the abort happened after the initial `fetch()` already got a response and started streaming).
3. **There is no ref for this to leave stale** — `preBumpDemoUsedRef` no longer exists anywhere in the file. The bump from step 1 simply stands (matching the "abort plausibly already charged" reasoning), with nothing pending to leak into a future call.
4. User sends an unrelated new message via `sendMessage`, which fails (e.g., network error). `sendMessage` never calls `bumpDemoUsageForRegenOrContinue` or `reanchorDemoCounter` — it only ever touches the transcript via `addMessage`, exactly as before this whole fix chain. `handleStreamError` runs its normal branching with no reference to any prior regenerate/continue state. Nothing from the earlier aborted regenerate call is touched, correctly or incorrectly — because there's no shared mutable state connecting the two calls anymore.

**Breakage 3 — transient adoption stop exposes the prior document's chat instead of its error.**
Walked as the explicit "doc-A→doc-B transient case" below.

### Doc-A→doc-B transient adoption failure (COMMIT-2, the case r3 flagged + the explicitly requested walk-through)

1. User is on document A, actively chatting: `sessionId = 'session-A'`, `messages = [...A's transcript...]`, `documentStatus = 'ready'`. `ChatPanel` is rendering normally.
2. User navigates in-app to document B (e.g. clicks a different demo sample, or a collection document). `documentId` changes to B's id. `useChatSession`'s effect depends on `documentId`, so it re-runs — but is gated by `documentStatus !== 'ready'`, and B's `documentStatus` may briefly still reflect A's `'ready'` value from before `useDocumentLoader`'s effect updates it (or may already be non-ready) — either way, once this effect's guard passes for B, its body executes.
3. **Reset (COMMIT-2's new lines) runs synchronously**: `setDemoMessagesUsed(0)`, `setDemoRestoredUserMsgCount(0)`, `setSessionId(null)`, `setMessages([])`, `setSessions([])`. At this instant, the store no longer references A's session or transcript at all.
4. Render (before any async work resolves): `documentStatus === 'ready' && sessionId` → depends on B's `documentStatus`, but `sessionId` is `null` either way → the `ChatPanel` branch is false. `sessionErrorCopy` is not yet set (no error yet) → false. Falls to `documentStatus !== 'ready' && !error` — true if B isn't marked ready yet, showing the existing "processing" skeleton; if B's `documentStatus` happens to already read `'ready'` (stale), falls one more level to the `{t('doc.initChat')}` placeholder. Either way: no stale A content, no blank render.
5. The async body proceeds: `readDemoSession(B)` finds a stored pointer for B, calls `getMessages(storedSessionForB)`, which fails **transiently** (network blip, 5xx).
6. Per `f594007` (unchanged by COMMIT-2): `status` is not 404/403, so the pointer for B is left intact, `setSessionError(e)` fires, and the effect returns — no fall-through to `listSessions`/`createSession`.
7. Render now: `sessionId` is still `null` (never set to anything in this failed attempt — COMMIT-2's reset from step 3 is the LAST write to `sessionId` in this run) → `ChatPanel` branch still false. `sessionErrorCopy` is now truthy (derived from the `sessionError` just set) → **this branch renders**: the retryable error card, correctly identifying that document B's session failed to load — not A's stale chat.
8. User reloads (or the transient issue resolves and they navigate again): `useChatSession`'s effect reruns from the top for B, resets again, retries `readDemoSession(B)` → same still-valid pointer → `getMessages` succeeds this time → B adopts normally.

This is the exact scenario r3's breakage 3 described, and step 7 is where the old code (pre-COMMIT-2) would have kept rendering A's `ChatPanel` (since `sessionId` still held `'session-A'`) — the fix closes precisely that gap.

### Verification (Codex r3 items)

- `cd frontend && npx tsc --noEmit` — clean, checked after each commit.
- `cd frontend && npx next lint --quiet` — `✔ No ESLint warnings or errors`.
- Traced `frontend/src/lib/sse.ts` in full (not assumed) to establish the precise distinction between callback-reported errors (resolve normally) and thrown fetch rejections (reject) — this distinction is why COMMIT-1 needed two separate mechanisms (`onErrorOverride` + try/catch) rather than one.
- Traced `DocumentReaderPageClient.tsx:366-393`'s full ternary chain (not just the first two branches) to confirm the transient window before an error is set renders a benign placeholder, not a blank page.
- No live browser/backend verification possible in this environment, as with every prior round.

### Concerns

1. As in every prior round, none of this was exercised live — the walkthroughs above trace actual code paths and line numbers but aren't a substitute for the team lead's live re-verification.
2. `reanchorDemoCounter`'s GET is fire-and-forget from inside `regenerateLastResponse`/`continueGenerating`'s catch/error paths — if it resolves AFTER the user has already navigated away or the component unmounted, `useDocTalkStore.getState()` still works (Zustand's store is module-level, not tied to component lifecycle), so this can't throw, but it could theoretically write demo-counter state for a session the user is no longer looking at. Given the values it writes are always "current server truth" and "current live transcript count" (recomputed fresh at the time it resolves, not stale closure values), I don't believe this is actually wrong even in that case — but flagging since it wasn't explicitly discussed.

---

## Unmount-race hardening (commit `ffe2461`)

Team lead flagged concern #2 above as worth closing before r4: a `reanchorDemoCounter` call made for session A could resolve after `useChatSession`'s synchronous reset (COMMIT-2) has already moved the store to session B — the straggler would then overwrite B's freshly-established server truth with A's stale fetched data, since the write path had no awareness of which session was "current" at resolve time versus at call time. Fixed by re-reading `useDocTalkStore.getState().sessionId` inside the `.then()` callback (not the `forSessionId` parameter captured in the closure at call time) and comparing it against `forSessionId`: the two fields are only written if they still match, otherwise the result is dropped silently with a comment explaining why (B's own adopt/create path is the authoritative source for B's counter, so a same-session write is the only one that could ever be correct). This is a single, minimal, additive change — no other logic in `reanchorDemoCounter` or its callers changed. `npx tsc --noEmit` and `npx next lint --quiet` both clean.

---

## Codex r4 (1 item, one commit)

Review: `.collab/reviews/2026-08-02-p0-demo-retune-codex-r4.md` (report tail, lines 4761–4776). Commit: `51b470b`.

r4 confirmed all three r3 fixes ADDRESSED and found one remaining IMPORTANT: the sessionId guard from the unmount-race hardening protects against a stale reanchor clobbering a *different* session, but not a *same-session* race — a failed regenerate's `reanchorDemoCounter` GET can still be in flight when the user sends a brand-new message on the same session (which never changes `sessionId`), and when the stale GET finally resolves it silently erases that new message's accounting delta with no later re-anchor to correct it (success paths don't reanchor).

### The fix — a monotonic accounting epoch

Added `demoAccountingEpoch: number` to the store (init `0`) and `bumpDemoAccountingEpoch()`, bumped by every operation that mutates `demoMessagesUsed`/`demoRestoredUserMsgCount`, per the instruction's exact list:
- `useChatSession`'s synchronous top-of-effect reset (alongside the existing `setDemoMessagesUsed(0)`/`setDemoRestoredUserMsgCount(0)`).
- The reuse branch's successful adopt (after `setDemoRestoredUserMsgCount(restoredUserMsgCount)`/`setDemoMessagesUsed(msgsData.demo_messages_used ?? 0)`).
- The `createSession` branch's successful create (after the same pair of setters, inside the `s.demo_messages_used != null` block).
- `useChatStream`'s `sendMessage` start, guarded on `maxUserMessages != null` (a plain `sendMessage` doesn't touch `demoMessagesUsed` directly, but it changes what `localUserMsgCount` will count, which is exactly the class of event a stale reanchor must not silently overwrite).
- `bumpDemoUsageForRegenOrContinue` (bumps immediately after its existing `+1`).

`reanchorDemoCounter` captures `epochAtCall = useDocTalkStore.getState().demoAccountingEpoch` synchronously at call time (before the `getMessages` GET even starts), and in the resolve guard now requires `state.demoAccountingEpoch === epochAtCall` (read fresh via `getState()`, not the captured closure value) **in addition to** the existing `state.sessionId === forSessionId` check — both must hold, or the result is dropped silently exactly like the existing session mismatch case, with a comment explaining why.

`reanchorDemoCounter` itself deliberately does **not** bump the epoch — it's a read of server truth, not a new accounting event. I confirmed this doesn't create a self-defeating loop: `epochAtCall` is captured when `reanchorDemoCounter` is invoked (which is always AFTER the triggering `bumpDemoUsageForRegenOrContinue` call for that same attempt, since the bump happens before the stream starts and the reanchor only fires once the stream fails), so a reanchor's own baseline already includes its own attempt's bump — it only gets invalidated by a mutation that happens strictly *after* the reanchor was issued.

### Codex's concrete send-race scenario, walked against the new code

1. User's demo session has `demoMessagesUsed = 1`, `demoRestoredUserMsgCount = 1` (steady state, nothing new sent yet). Current epoch: call it `E0`.
2. User clicks Regenerate. `bumpDemoUsageForRegenOrContinue()` fires: `demoMessagesUsed` → 2, and bumps the epoch to `E1`.
3. The regenerate stream fails (say, a 404 from the continuation-adjacent endpoint — matches r4's "charged failure" framing). The wrapped `onError`/catch fires `reanchorDemoCounter(sessionId)`. At this instant, `epochAtCall` is captured as `E1` (the epoch already reflects step 2's own bump).
4. `reanchorDemoCounter`'s `getMessages(sessionId)` GET is now in flight — say the server's authoritative count is also `2` at this point (matching the optimistic bump, since the failure did charge quota, per r4's scenario).
5. **Before that GET resolves**, the user sends a brand-new message via the composer. `sendMessage` fires: `addMessage(userMsg)` (transcript now has one more user message), and — the new line from this commit — `if (maxUserMessages != null) bumpDemoAccountingEpoch()` → epoch moves to `E2`. `sessionId` is unchanged (still the same session).
6. The stale GET from step 3 finally resolves with its snapshot (`demo_messages_used: 2`, captured `epochAtCall: E1`). The resolve guard checks: `state.sessionId === forSessionId` → true (same session, so this check alone would have let it through, matching r4's diagnosis that the sessionId guard is insufficient here) — **but** `state.demoAccountingEpoch !== epochAtCall` → `E2 !== E1` → **true**, so the write is skipped. `demoMessagesUsed` stays whatever `sendMessage`'s own accounting left it at (unchanged by `sendMessage` itself, since it doesn't touch this field — but critically, NOT reset to the stale `2`, and `demoRestoredUserMsgCount` is NOT re-baselined against the live transcript either, so the new message's delta in `localUserMsgCount` survives untouched).
7. Net effect: the new message's usage delta is preserved. The stale regenerate-triggered reanchor is dropped silently, exactly as Codex's required revision specified ("introduce same-session accounting/version ordering that cannot discard intervening sends or newer authoritative results").
8. If nothing else fails afterward, the counter may be marginally stale relative to server truth (the regenerate's charge from step 2's optimistic bump was never independently re-confirmed, since the epoch moved before the reanchor could apply) — but this is the same bounded, self-correcting drift the whole re-anchor design already accepts: any later failure anywhere issues its own fresh reanchor against current state, and a full page reload always re-syncs via `useChatSession`'s adopt path regardless.

### Verification

- `cd frontend && npx tsc --noEmit` — clean.
- `cd frontend && npx next lint --quiet` — `✔ No ESLint warnings or errors`.
- Confirmed via re-reading the instruction and the r4 report text (line 4778) that the `getState()` guard itself has no intra-turn TOCTOU — the check and both setters run synchronously in one JS turn inside the `.then()` callback, so the defect was purely about stale cross-request ordering, which the epoch directly targets, not about a race within the guard's own execution.
- Did not touch `SessionDropdown.tsx`'s `onNewChat`/`onSwitchSession`, which also mutate the two counter fields — reasoned through why they don't need an epoch bump: both change `sessionId` to a different value as part of the same operation, so the EXISTING sessionId guard already fully protects against a stale reanchor interacting with either of them (a session-id mismatch alone is sufficient there; the epoch only matters for same-session races, which switching sessions can't produce). Not in the instruction's explicit list either, which is consistent with this reasoning.
- No live browser/backend verification possible in this environment, as with every prior round.

### Concerns

1. As always, this is traced against the code, not exercised live.
2. Confirmed no other reader of `demoAccountingEpoch` exists or is needed — it's write-only from the five listed mutation points and read-only from `reanchorDemoCounter`'s resolve guard.

---

## Codex r5 (2 residual holes, one commit)

Review: `.collab/reviews/2026-08-02-p0-demo-retune-codex-r5.md` (tail). Commit: `ba8c181`.

r5 accepted the epoch design overall and found two small residual holes, both letting a stale reanchor slip past the guard added in r4/`51b470b`.

**Correction to my own r4 report**: I had written above (concern #2 in that section) that I deliberately skipped bumping `SessionDropdown`'s handlers because "switching sessions always changes sessionId." Codex r5 caught that this reasoning was wrong — the current session's row in the dropdown stays clickable (`SessionDropdown.tsx`'s session-list `onClick={() => onSwitchSession(s.session_id)}` isn't disabled for `s.session_id === sessionId`), so an A→A "switch" is possible, and `onSwitchSession`'s install writes both counter fields with `sessionId` unchanged. Noting the correction plainly rather than quietly fixing it — my earlier reasoning missed this.

### Hole 1 — `reset()` restores the epoch to 0, breaking monotonicity across resets

`store/index.ts`'s `reset()` spread `initialState` (which includes `demoAccountingEpoch: 0`) into the new state, so every "Back Home" click silently rewound the epoch. Fixed by explicitly overriding it in the same `set()` call: `demoAccountingEpoch: state.demoAccountingEpoch + 1` instead of inheriting `initialState`'s `0`. This guarantees every epoch value the store has ever held is used at most once for the lifetime of the page — reset now *advances* the epoch (consistent with "an accounting-mutating event," which a reset arguably is, since it discards the session context that grounded any prior value) rather than rewinding it.

**Codex's ABA trace, walked against the new code:**
1. User is chatting; the store's `demoAccountingEpoch` has climbed to `2` through normal use.
2. A regenerate fails: `bumpDemoUsageForRegenOrContinue()` bumps the epoch to `3`, and the failure path calls `reanchorDemoCounter(sessionId)`, which captures `epochAtCall = 3` and issues its GET. The GET does not resolve yet.
3. User clicks "Back Home" (`SessionDropdown.tsx`'s `onBackHome` → `reset()`). **Before this fix**: `reset()` would restore `demoAccountingEpoch` to `0`. **After this fix**: `reset()` instead computes `state.demoAccountingEpoch + 1 = 4`. The pending GET from step 2 is unaffected (fire-and-forget, no abort).
4. User reopens the same document. `useChatSession`'s effect runs its synchronous reset: `bumpDemoAccountingEpoch()` → epoch `5`. Adoption succeeds (the stored pointer still names the same session, assuming it's still valid): the reuse branch's post-adopt bump → epoch `6`.
5. User sends a new message on the reopened session: `sendMessage`'s guarded bump → epoch `7`.
6. The step-2 GET finally resolves. Resolve guard checks: `sessionId` match — plausible if the reopened session happens to be the same one (the ABA scenario Codex specified). `demoAccountingEpoch` check: current epoch is `7`, captured `epochAtCall` was `3` → **`7 !== 3`**, guard fails, write dropped.
7. Contrast with the pre-fix world Codex traced: without this fix, step 3's `reset()` would have dropped the epoch to `0`, and steps 4–5's three bumps would have landed on `1`, `2`, `3` — exactly matching the stale GET's captured `epochAtCall = 3` again, so the guard would have incorrectly passed and overwritten step 5's fresh accounting with the step-2 snapshot. The always-increment fix means no sequence of bumps after a reset can ever reproduce a pre-reset epoch value, closing the collision entirely (not just making it statistically less likely).

### Hole 2 — `onSwitchSession`'s A→A reuse install had no epoch bump

**Codex's A→A switch case, walked against the new code:**
1. User is on session A (`sessionId = 'A'`), `demoAccountingEpoch = 2`, dropdown open, session A's row is the current one but still clickable.
2. A regenerate on session A fails: bump → epoch `3`; `reanchorDemoCounter('A')` captures `epochAtCall = 3` and issues its GET (still in flight).
3. User clicks session A's own row in the dropdown (a no-op session-wise, but the handler doesn't special-case "already active"). `onSwitchSession('A')` runs: `setSessionId('A')` (unchanged value, but still executes), `getMessages('A')` resolves with `demo_messages_used` present, and — **the new line from this commit** — after installing `demoRestoredUserMsgCount`/`demoMessagesUsed`, `bumpDemoAccountingEpoch()` fires → epoch `4`.
4. The step-2 GET resolves. Resolve guard: `sessionId === 'A'` still matches (A→A never changed it, exactly as Codex noted the sessionId guard alone couldn't catch this) — **but** `demoAccountingEpoch` check: current epoch `4` vs captured `epochAtCall = 3` → mismatch, write dropped.
5. Without this commit's bump in step 3, the epoch would still have been `3` at step 4 (nothing in the A→A switch would have advanced it), matching `epochAtCall` and incorrectly overwriting `onSwitchSession`'s just-installed truth with the stale regenerate-triggered snapshot.

### Verification

- `cd frontend && npx tsc --noEmit` — clean.
- `cd frontend && npx next lint --quiet` — `✔ No ESLint warnings or errors`.
- Re-checked `SessionDropdown.tsx`'s session-list button (the `onClick={() => onSwitchSession(s.session_id)}` row) to confirm Codex's claim that it isn't disabled/no-op'd for the current session — confirmed, no `s.session_id === sessionId` guard exists there, so A→A really is reachable exactly as described.
- No live browser/backend verification possible in this environment, as with every prior round.

### Concerns

1. As always, this is traced against the code, not exercised live.
2. `onBackHome`'s `reset()` now bumps the epoch as part of a "reset," which is a slightly different category from the other five bump points (all of which install NEW authoritative counter values, whereas `reset()` installs `initialState`'s `demoMessagesUsed: 0`/`demoRestoredUserMsgCount: 0` — i.e., it's simultaneously an "install" and the mechanism this fix uses to guarantee no future epoch collision with anything pre-reset). This is intentional and matches the instruction's `set((s) => ({ ...initialState, demoAccountingEpoch: s.demoAccountingEpoch + 1 }))` shape exactly, but flagging the conceptual overlap in case it's worth a second look.
