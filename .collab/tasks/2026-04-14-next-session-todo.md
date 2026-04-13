# Next Session TODO — handoff from 2026-04-13

**Shipped today**: 18 commits across design overhaul (Phase 1+2+3 + 30-agent synthesis + Phase 1 exec), SEO CDN unlock, Sources Strip, Trust Center, signature logo, theme fix, CLAUDE.md/AGENTS.md rewrite. All on `stable`.

Pick up from here.

---

## 🔴 Time-sensitive — check before doing anything else

### 1. SEO observation period (weekly check)
Started **2026-04-13 18:00** with `ff56f5d` unlocking CDN caching.

- **Week 1** (by 2026-04-20): GSC → Coverage → confirm > 50 URLs "Submitted and indexed" (up from whatever pre-fix baseline was)
- **Week 4** (by 2026-05-11): GSC → Performance → Impressions should be > 100/week (baseline: single digits)
- **Week 8** (by 2026-06-08): Clicks > 20/week → traffic unlocked

If **no movement by week 3**: something else is blocking. Re-diagnose `curl -sI https://www.doctalk.site/...` and check GSC "Why pages aren't indexed" reasons.

### 2. Stripe Live mode switch (before real selling)
Currently `STRIPE_SECRET_KEY=sk_test_*` on Railway. Any real purchase will fail.

**User does** (Claude can't touch Stripe dashboard):
1. Stripe Dashboard → toggle to Live mode
2. Recreate 7 Price objects (Boost / Power / Ultra + Plus/Pro × Monthly/Annual)
3. Create live webhook endpoint secret
4. Railway: update 9 env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, 7 × `STRIPE_PRICE_*`)
5. Restart backend

Procedure reference: `.collab/tasks/2026-04-13-stripe-verification.md` §上线阻断项.

---

## 🟡 Design polish (Claude can do independently)

Sorted by ROI × risk:

### T3.D — Dark mode "designed for dark" upgrade (1 day)
Current dark mode is "inversion", not "designed for dark" (30-agent research flagged this 3 times).

**Claude does**:
- Add 3 surface-elevation tokens (`--surface-1/2/3` ≈ `#09090b / #18181b / #27272a`), replace ad-hoc `dark:bg-zinc-900` uses
- Weight-shift in dark: `font-bold` → `font-semibold`, `font-semibold` → `font-medium` on prose + headings via `.dark` CSS override
- Accent desaturation in dark: `indigo-400` still bounces against pure black — drop to `indigo-300` + 5% desat
- Fix `glow-accent` gradient in dark (currently indigo-400 @ 100% → indigo-300 @ 70% opacity)

**Verify**: Lighthouse contrast, screenshot diffs across hero / chat / billing / profile.

### T3.C — Profile tabs → sidebar at md+ (half day)
Current profile page uses horizontal tabs (Profile / Credits / Usage / Account). 30-agent settings-pattern research: sidebar wins above md for ≥ 4 sections, future-proofs for Notifications / API keys.

**Claude does**:
- `ProfilePageClient.tsx` wrap `<main>` in `grid-cols-[220px_1fr]` on md+
- Convert `ProfileTabs.tsx` → `ProfileNav` with same active-section logic
- Keep mobile tabs (sm:hidden for sidebar, md:hidden for tabs)
- Add stub 5th section "Notifications" (empty state) to signal extensibility

### T3.A — Inline PrivacyBadge redesign (1-2h)
Codex 30-agent stripe-trust subagent flagged: current PrivacyBadge accordion hides trust, named providers missing.

**Claude does**:
- `PrivacyBadge.tsx`: drop accordion, promote 3 checks to always-visible inline
- Add provider names: "AES-256 (SSE-S3) · OpenRouter zero-retention · Delete in <60s"
- Link to `/trust` (shipped 2026-04-13)

---

## 🟡 Product UX (needs backend + frontend)

### T2.D-full — Perplexity "sources before tokens" (2-3h, 2 deploys)
SourcesStrip shipped today as **frontend-only** workaround; citations still flow inline with tokens. Full Perplexity pattern requires retrieval results to arrive BEFORE the LLM starts generating.

**Claude does**:
1. **Backend** (`backend/app/services/chat_service.py`): after retrieval completes, emit a new SSE event `chunks_retrieved` with `[{chunk_id, page, document_id, filename, snippet}]` BEFORE calling the LLM
2. **Frontend** (`components/Chat/ChatPanel.tsx` + `MessageBubble.tsx`): parse the new event, populate `message.citations` immediately (without text offsets — fill those inline when `[n]` emits)
3. Deploy backend to Railway + frontend to Vercel

**Risk**: backend SSE change can break streaming. Ship behind a feature flag (`ENABLE_CHUNKS_RETRIEVED_EVENT`).

### T3.E — Thinking steps for Thorough mode (2-3h)
30-agent streaming-UX research: Thorough mode 8-15s TTFT feels empty. "Retrieving → Reranking → Generating" checklist reduces perceived latency ~40%.

**Claude does**:
- Backend: emit `thinking_step` SSE events at retrieval start / retrieval done / generation start
- Frontend: collapsible "Reasoning" card above assistant bubble, Thorough mode only, matches Claude.ai's tool-call cards pattern

---

## 🟢 Content / i18n debt (Claude can do, low priority)

### i18n sync — OCR FAQ in 9 stale locales
Only `en` + `zh` updated with the correct "DocTalk has Tesseract OCR" copy. The other 9 (ar/de/es/fr/hi/it/ja/ko/pt) still have the old misleading "scanned PDFs may have limited text extraction".

**File**: `frontend/src/i18n/locales/*.json` key `useCasesLawyers.faq.q4.answer`.

---

## 🔵 User-blocked (Claude cannot do)

### O-2 — Real scanned OCR samples
Need user to provide **3-5 real scanned PDFs** (contracts / invoices / handwritten annotations / low-quality copies). Without them, OCR production go/no-go decision stays deferred.

Once user uploads, Claude runs Mistral Document AI / Tesseract-tuned / pdfplumber-ocr benchmark and produces decision report.

### Product Hunt / Indie Hackers launch
Frontend is now polished enough. User's call on timing + writing the launch post.

Pre-launch checklist Claude recommends:
- [ ] Stripe Live mode switched (no fake "buy now" on launch day)
- [ ] SEO observation shows at least week-1 movement
- [ ] Real "X users chatting with Y documents" number to quote (currently 20 testers 2 active — wait a few weeks?)

### Baidu / Naver / Yandex webmaster accounts
For `zh` / `ko` / `ru` markets. User creates accounts and submits sitemaps.

---

## 🔵 Deferred / needs decision

### P3 CSP full nonce migration
Report-Only header is live (`ff56f5d`). Observation period ~1-2 weeks. After that, decide:
- **Option A**: full nonce rewrite (Next 14 middleware nonce injection, all JSON-LD → `<JsonLdScript nonce={...}>`). Breaks static prerender on ~108 pages.
- **Option B**: hash-based CSP for the ~5 known inline scripts. Keeps static prerender. More manual per script.
- **Option C**: accept `'unsafe-inline'` as permanent risk. Document in `/trust`.

Decision date: 2026-04-27 (2 weeks after Report-Only ship).

### Phase 2 SEO content (15 blog posts + 5 use cases)
Plan exists at `.collab/plans/seo-master-plan-phase2.md`. Blocked on user choosing keyword clusters to target.

### Phase 1 remaining design items
- **CTA copy A/B test** — "Start with a sample doc" vs variants. Needs traffic to measure.
- **Hero artifact refinement** — if user finds issues after more browsing.

---

## 📌 Context restoration for next session

**Files to skim first**:
1. This file (`.collab/tasks/2026-04-14-next-session-todo.md`)
2. `CLAUDE.md` (rewritten 2026-04-13 per Anthropic best practices)
3. `.collab/plans/2026-04-13-design-overhaul-synthesis.md` (30-agent research distilled)
4. `.collab/reviews/2026-04-13-stripe-phase-b-closeout.md` (payment verification status)

**Recent key commits**:
- `63a2aa4` — CLAUDE.md/AGENTS.md rewrite
- `ba30e84` — /trust page + GitHub footer badge
- `ff56f5d` — SEO CDN unlock (biggest business impact today)
- `1806060` + `9696c91` — SourcesStrip
- `540d640` — Phase 1 design (warm canvas + hero artifact)

**State of stable branch**: everything above is deployed. `doctalk.site` live.

---

## Suggested next-session opening (pick one)

1. **"SEO 一周了看 GSC"** → Claude helps you interpret GSC metrics
2. **"做 T3.D dark mode"** → Claude 1-day batch, standalone
3. **"上 Stripe live"** → mostly user task with Claude support
4. **"O-2 我上传了 5 个扫描 PDF"** → Claude runs OCR benchmark
5. **"Product Hunt 要发布了帮我起草文案"** → Claude drafts launch post
