# Frontend Audit — Round 1 (Claude → Codex adversarial review)

**Date:** 2026-05-20
**Source:** 8 parallel `feature-dev:code-reviewer` agents covering the whole `frontend/` (editorial marketing layer, app shell + auth, PDF reader, chat, collections + profile + admin, billing + subscriptions, home/dashboard/demo, cross-cutting infra).
**Filter applied:** confidence ≥ 75.
**Branch:** `editorial-marketing` (27+ commits ahead of `origin/main`, not pushed, not deployed).

## What I need from this round

You are Codex (`gpt-5.3-codex`). I am Claude. Per `CLAUDE.md`'s collaboration protocol, this audit goes through adversarial review before any fix is implemented. **Challenge every finding below.** For each item:

1. **Verify in the actual code.** Read the file(s) named. The line numbers in this report were produced by 8 different agents over a single pass and may have drifted (the file may have been edited between agents, or the agent may have miscounted). Re-locate the issue if needed.
2. **Decide a verdict:** `ACCEPT` (real and severity is right) / `ACCEPT-RECALIBRATE` (real but severity should change — say to what) / `REJECT-FALSE-POSITIVE` (not actually a bug — say why) / `ACCEPT-REFINE-FIX` (real but the recommended fix is wrong or incomplete — say what's better).
3. **For Critical/Important items:** state your confidence after verification.
4. **At the end:** list any issues you'd ADD that the 8 agents missed, and propose a **consensus-ready Wave-1 / Wave-2 split** that you'd sign off on.

Do not be polite. The whole point of this round is to find findings that don't hold up to scrutiny — false positives waste fix-cycles and erode trust in the audit. **Be especially adversarial on the security findings** (#1, #2) — those are the highest-cost-if-wrong claims in the report.

Read the project rules first: `/Users/mayijie/Projects/Code/010_DocTalk/CLAUDE.md`, `/Users/mayijie/Projects/Code/010_DocTalk/.claude/rules/frontend.md`, `/Users/mayijie/Projects/Code/010_DocTalk/.claude/rules/backend.md`, `/Users/mayijie/Projects/Code/010_DocTalk/docs/ARCHITECTURE.md` (§10 is the operational integrity section).

## Recent context (do not re-flag)

- Phase 2 editorial-marketing redesign just landed on this branch. Per-task code reviews already passed.
- Editorial layer uses terracotta `--ed-signal #b0472f`, warm-paper, Newsreader serif, IBM Plex Mono. App UI uses zinc + blue `#1D4ED8` / `#60A5FA` and supports dark mode. The "unify into one system" question was tried (Stage 1 token-bridge to blue) and reverted — locked at TWO surfaces sharing one token base.
- `dt-stitch-theme` and `--workbench-*` are intentional structural classes (isolate context), NOT a theme-removal regression — `globals.css` has a "KEEP" comment confirming this. Don't re-flag.
- 5 use-cases + tools + 2 alternatives pages are hardcoded English (pre-existing, no i18n). Out of scope.

## Findings

### 🔴 Critical (10)

**C1. `AUTH_SECRET` sent in plaintext as `X-Proxy-IP-Secret` header**
- Files: `frontend/src/app/api/proxy/[...path]/route.ts:81-84`, `frontend/src/app/shared/[token]/page.tsx:31-32`
- Auditor claim: the header contains the literal `AUTH_SECRET` value. If the Vercel→Railway connection isn't end-to-end TLS, or the backend logs headers, the signing key is exposed. `AUTH_SECRET` is the same key Auth.js uses to decrypt session JWEs — exposure means arbitrary session forgery.
- Recommended fix: `HMAC-SHA256(AUTH_SECRET, clientIp + ":" + Math.floor(Date.now()/30000))`; backend verifies the HMAC. Secret never crosses the wire.
- **Adversarial questions for Codex:** (a) Read the proxy file. Does it actually send the raw secret, or is it already an HMAC? Memory `seo-growth.md` and `ARCHITECTURE.md` reference an "HMAC-signed IP trust chain via the Vercel edge" — does the code match that description? (b) If it IS the raw secret, is the backend's `X-Adapter-Secret` for Auth Adapter calls the same secret? Combined risk? (c) Does Railway internal networking guarantee TLS? Verify before sign-off.

**C2. `NEXT_PUBLIC_API_BASE` referenced from server-side proxy code**
- File: `frontend/src/app/api/proxy/[...path]/route.ts:5` → `const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"`
- Auditor claim: the proxy is a server-only Route Handler but it reads `NEXT_PUBLIC_*` (which Next.js inlines into the client bundle). This leaks the public Railway URL into the client bundle. Compare `auth.ts:11` and `authAdapter.ts:3` which prefer `BACKEND_INTERNAL_URL`. Also performance: SSE traffic routes through Railway's public ingress rather than Vercel→Railway internal.
- **Adversarial questions for Codex:** (a) Is `NEXT_PUBLIC_API_BASE` actually different from what would be in `BACKEND_INTERNAL_URL` on Vercel? Per `CLAUDE.md`, NEXT_PUBLIC_API_BASE is "never localhost in prod" — does the prod value contain the Railway URL? (b) Is there a downside to changing the priority order, e.g., breaking local dev where only `NEXT_PUBLIC_API_BASE` is set? (c) The bundle-leak claim — verify that `process.env.NEXT_PUBLIC_API_BASE` referenced inside a Route Handler actually inlines into the client bundle (it shouldn't, because Route Handlers are server-only). Is the leak claim real?

**C3. `confirmDeleteDocument` removes from UI even if backend delete fails**
- File: `frontend/src/app/HomePageClient.tsx:337-354`
- Auditor claim: try/catch wraps `deleteDocument()` but the `setServerDocs(...)` removal runs unconditionally — so a 403/500/network failure still removes the doc from the visible list, misleading the user.
- Fix: move the removal into the try-block; show inline error on catch.
- **Adversarial:** verify the catch isn't actually re-throwing or otherwise gating the state mutation.

**C4. `handleAddDocs` in collection detail has no try/catch**
- File: `frontend/src/app/collections/[collectionId]/page.tsx:150-156`
- Auditor claim: `getMyDocuments()` rejection silently aborts the click — modal never opens, no error surfaced.
- **Adversarial:** is the modal-open gated on a successful response, or is it always set true and just shows empty? If the latter, the only impact is empty modal, not silent failure.

**C5. Upload polling timer (`setInterval`) leaks on unmount**
- File: `frontend/src/app/HomePageClient.tsx:254-281`
- Auditor claim: timer is a local `const` inside the `onFiles` callback; no `useEffect` cleanup, no ref. If the user navigates away mid-parse (parse can take 600s for big PDFs), the interval keeps firing → setState on unmounted component → unbounded background fetches.
- **Adversarial:** does the interval `clearInterval` itself when polling completes? If yes, the leak is only for the unmount-while-polling window. Quantify the actual impact.

**C6. `navigator.clipboard.writeText` in MessageBubble has no `.catch`**
- File: `frontend/src/components/Chat/MessageBubble.tsx:210`
- Auditor claim: unhandled promise rejection on iOS Safari, non-HTTPS, or denied clipboard permission. Other call sites (`ChatPanel.tsx:269-283`) handle this correctly with a textarea fallback.
- **Adversarial:** is the rejection actually "unhandled" (does React's error boundary catch it?), or just noisy in console? Severity might be Important not Critical.

**C7. PdfToolbar search nav buttons mislabeled as "Previous page" / "Next page"**
- File: `frontend/src/components/PdfViewer/PdfToolbar.tsx:137,140`
- Auditor claim: copy-paste from page nav. Search buttons announce as page nav to screen readers. i18n keys `toolbar.prevMatch` / `toolbar.nextMatch` don't exist in any locale.
- **Adversarial:** verify the labels are actually wrong on the *match* buttons (not the page buttons). Are the two buttons close to each other and easy to confuse in the source?

**C8. `processCitationLinks` recurses into `<code>` children**
- File: `frontend/src/components/Chat/MessageBubble.tsx:85-88`
- Auditor claim: when an LLM emits `` `[1]` `` (citation marker inside a backtick code span), the ReactMarkdown `em`/`p` overrides recurse into the `<code>` element and replace `[1]` with `<CitationPopover><button>`. Produces `<code><button>...</button></code>` — invalid HTML nesting.
- **Adversarial:** how common is this in practice? Do LLMs actually produce `` `[1]` ``? Or is it a theoretical concern?

**C9. `hover:text-white` on logo/nav in white-bg headers (light mode bug)**
- Files: `frontend/src/components/AppHeaderShell.tsx:33`, `frontend/src/components/PublicHeader.tsx:25,36`
- Auditor claim: hovering the logo in light mode turns the text white on a white background → invisible. Dark mode is unaffected (header is near-black).
- **Adversarial:** does the header actually have a white background in light mode? Or is it `bg-zinc-50` or similar where white-on-near-white is just low contrast not invisible? Reproduce.

**C10. `EdFaqList` accordion opens at `height=0` on first frame**
- File: `frontend/src/components/marketing/EdFaqList.tsx:64-73`
- Auditor claim: `height` state defaults to 0; on first `isOpen=true`, render sees 0 then `useEffect` measures `scrollHeight` and updates → one frame of collapsed-to-expanded jump. `useLayoutEffect` would fix.
- **Adversarial:** is the jump actually visible? Modern browsers may batch this within a single paint. Test severity.

### 🟠 Important (15) — abbreviated below; full detail in the 8 sub-reports

**I11. `--ed-ink-3 #8b857a` on `--ed-paper #f3eee1` is ~3.3:1 contrast (WCAG AA fails)** — entire editorial surface's captions/labels/breadcrumb. (`editorial.css:8`)

**I12. Editorial Header has no mobile nav (hidden md:)** — 3 nav links inaccessible on phones. (`EditorialHeader.tsx:68`, `EditorialMarketingHeader.tsx:68`)

**I13. 5 modals lack focus trap / aria-labelledby / role placed wrong** — PaywallModal, ConfirmUpgrade, ConfirmDowngrade, ConfirmCancel, AccountActionsSection delete, FeedbackButton. (Several files.)

**I14. ProfileTabs has `role="tab"` but no `role="tabpanel"` / `aria-controls` wiring** — broken ARIA tabs pattern. (`ProfileTabs.tsx`, `ProfilePageClient.tsx:159-205`)

**I15. Multiple `<th>` elements missing `scope="col"`** — credit history table, usage breakdown, admin user tables. (`CreditsSection.tsx:193-198`, `UsageStatsSection.tsx:158-163`, `AdminPageClient.tsx:227-232,696-706,769-779`)

**I16. `billing.free.credits = "500"` in all 11 locales** — wrong (should be 300 per `frontend.md`).

**I17. `billing.perMonth` not translated in `ar.json` (still `/mo`)** — possibly other locales too.

**I18. PaywallModal upgrade CTA always targets `plan: 'plus'`** — Pro user hitting paywall (e.g. PRO_MODE_LIMIT) gets sent to Plus, must re-select Pro. (`PaywallModal.tsx:113-118`)

**I19. Confirm upgrade/downgrade dialogs don't show target price or billing period** — user clicks "Confirm Upgrade" without knowing the charge amount. (`BillingPageClient.tsx`)

**I20. `displayedSuggestedQuestions` only honors `suggestedQuestions` prop when `locale === 'en'`** — non-English users never see doc-specific questions. (`ChatPanel.tsx:361-363`)

**I21. `MessageBubble` not memoized; ChatPanel passes new arrow fns each render** — every SSE token re-renders the whole thread. (`MessageBubble.tsx` export, `ChatPanel.tsx:403-446`)

**I22. `CookieConsentBanner` MutationObserver watches entire `document.body` subtree** — fires on every chat-stream token insertion. (`CookieConsentBanner.tsx:26-34`)

**I23. `SocialProof.tsx` border-left applied with `md:pl-6 md:border-l border-[var(--ed-rule)]`** — `border-[var(--ed-rule)]` has no `md:` prefix, so mobile gets a stray vertical line. (`SocialProof.tsx:83`)

**I24. Citation overlay animation replays on every zoom/scale change** — visually misleading. (`PageWithHighlights.tsx:176-188`)

**I25. TextViewer markdown mode renders citation match as a duplicate amber preview above + unhighlighted markdown below** — disconnected display. (`TextViewer.tsx:720-733`)

**I26. `ModeSelector` uses `slate-*` classes; `AdminPageClient` uses `bg-blue-100 / text-blue-700`** — palette rule says zinc + `--accent` token, not Tailwind blue/slate. (`ModeSelector.tsx:35,50`, `AdminPageClient.tsx:145`)

### 🟡 Code Quality (8)

**Q27.** `HomePageClient.tsx` is 650 lines with two unrelated rendering paths (landing vs dashboard).

**Q28.** `EditorialHeader` and `EditorialMarketingHeader` are near-duplicates. Extract shared base.

**Q29.** `CitationsClient.tsx:172-247` inlines a 4-col comparison table instead of extending `EdComparisonTable`.

**Q30.** `formatNumber` is duplicated across 3 admin files (`AdminPageClient.tsx:107`, `AdminCharts.tsx:49`, `AdminUserActivityCharts.tsx:41`).

**Q31.** Plan price strings (`$9.99`, `$7.99`, `$19.99`, `$15.99`) are hardcoded in JSX **and** also exist as i18n keys — two sources of truth, will drift.

**Q32.** `ErrorBoundary.componentDidCatch` is a no-op (`ErrorBoundary.tsx:35-37`) — production React errors are silently swallowed, no console.error, no telemetry.

**Q33.** `useDocumentLoader` does not reset PDF state (`searchQuery`, `searchMatches`, `highlights`, `grabMode`) on document switch — bleeds from previous doc.

**Q34.** Admin page mixes `tOr(...)` with raw English strings — inconsistent i18n discipline.

### 🟢 Existing / out-of-scope (do not re-flag)

PDF reader static assets (`public/pdf.worker.min.mjs`, `cmaps/`, `standard_fonts/`) presence verification needed but separate.
`dt-stitch-theme` / `--workbench-*` kept as structural isolate-context wrappers (per `globals.css` "KEEP" comment).
`UsageStats` still surfaces retired `thorough` mode (label says "Legacy"); arguably correct for historical data.
`StudentsClient`/`LawyersClient` insert hardcoded English anchor text mid-`EdProse` paragraph — flagged but pre-existing in non-localized form (`useCasesStudents.challenge.p2` is translated; the anchor literal between p2 and p3 is not).
SSE multi-line `data:` LF concatenation gap (`sse.ts:60`) — current backend emits single-line JSON; latent risk only.
`zh-TW` → `zh` Simplified mapping in `LocaleProvider.detectLocale`.
`usePageTitle` cleanup flashes `"DocTalk"` between navigations.

## Format I need back

```
## Round 1 review by Codex

For each finding C1..C10, I11..I26, Q27..Q34:
- Verdict: ACCEPT / ACCEPT-RECALIBRATE / REJECT-FALSE-POSITIVE / ACCEPT-REFINE-FIX
- Evidence (file:line you actually read)
- If recalibrate or refine: what specifically

## Missed findings
[list anything the 8 agents missed that you found]

## Consensus-ready proposal
Wave 1 = [list of finding IDs you'd sign off on right now]
Wave 2 = [list]
Drop = [findings you reject as false positives]

## Open questions
[anything you genuinely couldn't decide and need Claude to clarify]
```

Use the standard CLAUDE → Codex collab convention. Be direct. Push back where the evidence warrants. The goal is a fix list both of us can defend.
