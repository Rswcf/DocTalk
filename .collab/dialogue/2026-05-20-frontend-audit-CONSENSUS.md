# Frontend Audit — CONSENSUS (locked 2026-05-20)

**Process:** 6 rounds of Claude ↔ Codex adversarial review.
**Result:** Codex signed `**CONSENSUS**` in R6.

## What the iteration caught that the original audit missed

The audit started with 33 findings. Codex challenged every one over 6 rounds. The process surfaced THREE substantive errors in my own implementation specs that would have shipped real bugs:

- **R3 caught:** my original C1 spec used 30s window-bucket signing → deterministic header within window = trivial in-window replay. Fixed to per-request timestamp + 60s skew + constant-time compare.
- **R4 caught:** my legacy-branch fallback read `x-real-ip` but the production contract uses `x-real-client-ip` → would have collapsed all users to egress IP during the rollout window, triggering mass false-429s.
- **R5 caught:** my legacy-branch HMAC compared against `ADAPTER_SECRET` but the existing production secret is `AUTH_SECRET` → would have rejected all in-flight legacy requests, same false-429 collapse.

The adversarial review prevented an outage during the security fix itself. This is exactly the failure mode the CLAUDE.md collaboration protocol exists to prevent.

## Locked Wave 1 — 29 items, fix before merging branch

### C1 — Replace plaintext `X-Proxy-IP-Secret` with HMAC contract (the cross-cutting one)

**Frontend** (`route.ts:81`, `shared/[token]/page.tsx:32`): emit triple-header — `X-Proxy-IP`, `X-Proxy-IP-Ts` (unix seconds), `X-Proxy-IP-Sig` (HMAC-SHA256 of `ip + ":" + ts` with `ADAPTER_SECRET`).

**Backend** (`rate_limit.py:257-273`): `verify_signed_ip()` with `hmac.compare_digest` + `max_skew_s=60`. **Dual-accept legacy branch** that compares `X-Proxy-IP-Secret` against `AUTH_SECRET` (old contract) and reads `X-Real-Client-IP` for the trusted IP. Counters/logs: `proxy.signed_ip.verification_failed{reason}` + `proxy.signed_ip.legacy_path_used`.

**Tests** (`backend/tests/test_proxy_ip_verification.py`): 9 cases — valid, skew ±, malformed ts, bad sig, both-headers (new preferred), legacy-AUTH-SECRET passes, legacy-ADAPTER_SECRET fails (regression guard), legacy returns x-real-client-ip not client.host.

**CI** (`.github/workflows/ci.yml:29`): add the new test file to the backend job invocation.

**Docs** (the comprehensive .md sweep): `CLAUDE.md:61,63` + `AGENTS.md:66,105` + `docs/ARCHITECTURE.md §10:967` + `docs/ARCHITECTURE.zh.md` + `README.md:157` + `rate_limit.py:260,273` comments + `TrustPageClient.tsx:82` (soften "cannot be spoofed" → honest description) + `.env.example` (frontend `ADAPTER_SECRET`).

**Deploy sequence** (commit message + ARCHITECTURE §10 new subsection): Railway first → wait for /health → Vercel second → watch legacy_path_used → 24h later, follow-up commit removes legacy branch.

### C2 — Proxy env priority
`route.ts:5` → `BACKEND_INTERNAL_URL || NEXT_PUBLIC_API_BASE || localhost`.

### C3, C4, C5, C6, I28 — Silent failure family
- C3 `HomePageClient.tsx:337-354` — move delete UI update into try block; surface error on catch.
- C4 `collections/[collectionId]/page.tsx:150-156` — wrap `getMyDocuments()` in try/catch.
- C5 `HomePageClient.tsx:254-281` — upload polling timer in useRef + useEffect cleanup.
- C6 `MessageBubble.tsx:210` — `navigator.clipboard.writeText` add `.catch`.
- I28 `AccountActionsSection.tsx:36` — surface `exportError` state instead of silent swallow.

### C7, C8, C9 — Accessibility / correctness
- C7 `PdfToolbar.tsx:137,140` — fix search button labels + add `toolbar.prevMatch`/`toolbar.nextMatch` keys to 11 locales.
- C8 `MessageBubble.tsx:85-88` — skip citation-link recursion when child type is `code/pre/a/kbd/samp`.
- C9 `AppHeaderShell.tsx:33`, `PublicHeader.tsx:25,36` — replace `hover:text-white` with `hover:text-zinc-950 dark:hover:text-white`.

### I11–I15 — Editorial + Profile a11y
- I11 `editorial.css:8` — `--ed-ink-3: #8b857a` → `#6e6860` (4.6:1 contrast on `--ed-paper`).
- I12 `EditorialHeader.tsx:68`, `EditorialMarketingHeader.tsx:68` — add mobile hamburger / collapsed nav.
- I13 — focus trap + restore on 5 modals (ConfirmUpgrade / ConfirmDowngrade / ConfirmCancel / AccountActionsSection delete / FeedbackButton). PaywallModal already has trap — excluded.
- I14 `ProfileTabs.tsx:33`, `ProfilePageClient.tsx:159-205` — wire `role="tabpanel"` + `aria-controls` + `aria-labelledby`.
- I15 — add `scope="col"` to 4 tables (CreditsSection L193-198 + UsageStatsSection L158-163 + AdminPageClient L227-232 / L696-706 / L769-779).

### I16–I20 — Content / billing / i18n
- I16 — `billing.free.credits: "500" → "300"` in all 11 locales.
- I17 — translate `billing.perMonth` in `ar/es/hi/it/ja/ko`.
- I18 `PaywallModal.tsx:113-118` — derive target plan from `reason` (PRO_MODE_LIMIT + already-on-plus → 'pro').
- I19 `BillingPageClient.tsx` confirm dialogs — inject `{ targetPlan, period, price }` into copy.
- I20 `ChatPanel.tsx:361` — drop the `locale === 'en'` guard on `displayedSuggestedQuestions`.
- I27 `useChatStream.ts:108` — derive analytics `plan` from context, not hardcoded `'plus'`.

### I22, I23, I26 — Misc UX/visual
- I22 `CookieConsentBanner.tsx:26-34` — scope MutationObserver tighter than `document.body` subtree.
- I23 `SocialProof.tsx:84` — `border-[var(--ed-rule)]` → `md:border-[var(--ed-rule)]`.
- I26 `ModeSelector.tsx:35,50` — `slate-*` → `zinc-*`. `AdminPageClient.tsx:145` — Tailwind blue → `--accent` token.

### Q32, Q33 — Hygiene promoted into Wave 1
- Q32 `ErrorBoundary.tsx:35-37` — at minimum `console.error("ErrorBoundary caught:", error, errorInfo)`.
- Q33 `useDocumentLoader.ts` — call store reset on document switch (clear searchQuery / searchMatches / highlights / grabMode).

## Wave 2 — 10 items deferred

`C10` (FAQ height flash via useLayoutEffect), `I21` (MessageBubble memo + parent ref stabilization + avoid clone), `I25` (TextViewer markdown citation duplicate display), `Q27` (HomePageClient split), `Q28` (EditorialHeader shared base), `Q29` (extend EdComparisonTable to N cols), `Q30` (consolidate `formatNumber`), `Q31` (centralize price source-of-truth), `Q34` (admin i18n discipline), `Q35` (prometheus_client + /metrics endpoint).

## Dropped

`I24` (citation overlay zoom replay) — no repro, static evidence didn't support.

## Implementation order

C1 first (security, cross-cutting, deploy-sensitive). Then the silent-failure family (C3/C4/C5/C6/I28). Then a11y batches (C7/C8/C9 + I11–I15). Then content/billing (I16–I20/I27). Then misc (I22/I23/I26) + hygiene (Q32/Q33). Each batch: implementer → spec review → code review → fixes → build → commit.

C2 ships **inside** the C1 commit (small env-priority change, no separate review needed; verified by the proxy still reaching the backend under integration).
