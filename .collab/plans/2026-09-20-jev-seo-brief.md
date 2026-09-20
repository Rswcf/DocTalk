# Brief: Jev-assisted SEO optimization for DocTalk (2026-09-20)

Prepared by Claude (execution role) for **Fable 5.1 (design authority)**.
Per `memory/feedback-fable-plans-claude-executes.md`, the owner ruled on 2026-09-03 that all
planning/design/architecture is produced by Fable 5.1. The owner re-confirmed this routing today.
**You are being asked to design the plan. Claude will execute it.**

Everything below was verified today by Claude against the repo, production Postgres, and live docs.
Where a prior memory/report was found **stale**, that is flagged — do not build on the stale version.

---

## 1. The owner's request, verbatim in substance

> 借助 Jev，对我们网站现有的 SEO 进行优化。先 top-down、系统性、结构化地设计优化的流程和计划。
> 同时把今天从观察窗数据里看到的信息一并纳入这次 SEO 优化的考虑。

Owner's answers to the scoping questions (collected today):

| Question | Owner's answer |
|---|---|
| Relationship to the observation window | Read the data **today (09-20)** instead of waiting, then **execute directly**. Fold the observed data into the SEO plan. |
| Success metrics | **All four**: (a) indexation & technical health, (b) organic traffic / impressions, (c) AI-search visibility (GEO), (d) ICP-targeted conversion |
| `TYPESAFE_API_KEY` | Owner has one and is providing it. Slot prepared at `.env:76` (root `.env` = backend env; gitignored). |
| The Semrush tool site | Use it for **both** keyword data and competitor/trend analysis. Owner is logged in; Claude drives it in the browser pane. |

---

## 2. Governing prior ruling — this work is already authorized and is OVERDUE

`.collab/plans/2026-09-03-backlog-decision.md` §9.0 (your own ruling, 2026-09-08):

> **#3 Acquisition** | Starts now, bounded to work that does not touch the observed surface.
> Order: owner items first (web-filter categorization, Railway token — nothing below substitutes
> for them), then **one frontend-only branch (locale structured data, `/tools` inlinks,
> no-signup post CTA → `/demo`), ready by 2026-09-12**, shipped as a separate
> `git push origin stable` with **no version bump**. Anonymous upload and indexable share pages
> **stay out until 09-28**. v0.30.0 is not re-staged for any of it.

> **#1 Window** | **2026-09-21 = checkpoint** (defect triggers + first reads).
> **2026-09-28 = decision date.** Decide early on a non-owner day-2 return (positive) or the
> refined defect trigger (§9.8) firing (negative).

**Consequences for your design:**
- This SEO branch is **8 days late**, not premature. It needs no new authorization.
- Hard scope fence: **frontend-only, no version bump, separate `stable` push**.
- **Out of scope until 09-28**: anonymous upload, indexable share pages. (So the `shared/[token]`
  hard `noindex` at `app/shared/[token]/page.tsx:67` is a *deferred* item, not a defect to fix now.)
- The owner moved the *checkpoint* forward to 09-20. The **decision date 09-28 is unchanged** unless
  you rule otherwise.

---

## 3. Production data read today (2026-09-20 15:05 UTC), owner account excluded

Read-only, run inside the Railway backend container (`postgres.railway.internal` is not
externally reachable). Owner = `c142f3af-…`. Event table is **`product_events`** (NOT `events`;
columns: `event_name, source, reason, plan, billing, metadata_json, user_id, created_at` — there is
**no `path` column**, so per-path marketing traffic is not available from the DB).

### 3.1 THE HEADLINE: the purchase existence gate fired

| Event | All-history (non-owner) | Detail |
|---|---|---|
| `checkout_created` | **n=2, u=2**, last **2026-09-16** | The 09-16 one is inside the window, `source=upload_error` |
| `upgrade_click` | n=45, u=19, last 2026-09-16 | The 09-16 one is same user, same second, same source |
| `checkout_completed` | **n=1, u=1, last 2026-05-06** | Nobody has completed since May |
| `upgrade_nudge_shown` | n=16, u=9, last 2026-09-04 | |
| `citation_clicked` | n=163, u=19, last 2026-09-01 | |

Per §9.3/§598 this is **confirmation, not a decision**: the repaired button demonstrably opens
Stripe in the wild. The wall has moved to price/value, which §9.3 says is undecidable at this traffic.

The single intent event came from an **error path**: `source=upload_error`, alongside
`limit_hit` at `source=dashboard_upload_precheck`. The only two purchase intents DocTalk has ever
produced (2026-05-06 `file_size`, 2026-09-16 `upload_error`) are **both upload-limit events**.

### 3.2 Signups in the window: 4, and 3 of them never used the product

| user | registered | docs | sessions | user msgs | active days |
|---|---|---|---|---|---|
| `8bbef0a9` | 2026-09-11 | 0 | 0 | 0 | 0 |
| `982b4ec7` | 2026-09-13 | 0 | 0 | 0 | 0 |
| `e8fed11b` | 2026-09-16 | 0 | 0 | 0 | 0 |
| `dfb7cf45` | 2026-09-19 | 1 | 1 | **0** | 1 |

≈0.31 signups/day — consistent with the §9.1 measured rate, not the withdrawn "~1/day" assumption.

### 3.3 Retention still zero at the 4-day line

Distinct active days (by `sessions`, non-owner, all history): **1 day → 67 users, 2 days → 6,
3 days → 1, 4+ days → 0.** The §9.0 "decide early (positive)" trigger has **not** fired.

### 3.4 Marketing surface has live traffic

In-window, non-owner: `landing_cta_clicked` n=13 (`hero` 11, `final_cta` 2),
`auth_modal_opened` 7, `auth_provider_clicked` 12, `rag_verification_completed` 38.
Plan total: **174 users, all `free`. Zero active subscriptions.**

---

## 4. Repo SEO state — verified today, with three stale claims corrected

`memory/topdown-review-2026-08-25.md` is the last SEO inventory. Claude re-verified each claim:

| 08-25 claim | Verdict today |
|---|---|
| "320/403 non-English pages emit only generic `Article`; FAQPage/HowTo/SoftwareApplication all lost" | **STALE — do not build on it.** `MarketingArticleJsonLd` has **zero callers**. All 34 `app/[locale]/**` routes use the full hand-authored JsonLd components, which already emit FAQPage / BreadcrumbList / ItemList / SoftwareApplication / HowTo where the English root does. |
| "`/tools` two pages have zero internal links" | **HOLDS.** Only `app/sitemap.ts` and `i18n/routing.ts` reference them. No page links to them. |
| "share pages still hard `noindex`" | **HOLDS** (`app/shared/[token]/page.tsx:67`) — but §9.0 #3 **defers** this past 09-28. |
| — | **NEW DEFECT (found today):** `/features/layout-translation` is in `LOCALIZED_PATHS` (`i18n/routing.ts:45`) so 11 locale routes exist and the EN root exists — but it is **absent from `app/sitemap.ts`**, and `app/[locale]/features/layout-translation/page.tsx` emits **no JSON-LD at all** (the only locale route with none). **12 pages invisible to search.** |

Other verified facts:
- `app/sitemap.ts` builds from `LOCALIZED_PATHS` × `URL_LOCALES` + blog; hreflang reciprocal maps
  are emitted; `x-default` → en.
- `lib/seo.ts` `buildMarketingMetadata` handles canonical + hreflang for localized pages.
- `MarketingPageJsonLd` already supports FAQPage / Breadcrumb / ItemList / SoftwareApplication / HowTo
  as optional props — the substrate is there; the question is coverage, not capability.
- GSC is verified (`app/layout.tsx:86` verification meta). GA4 is live (`G-4JYFBL77WL`,
  `components/AnalyticsWrapper.tsx:10`).
- 11 locales: en/zh/ja/ko/es/de/fr/pt/it/ar/hi. Any i18n key must hit all 11 (`tOr` for new keys).

---

## 5. What Jev is, and its hard constraints

Installed today as the `typesafe:typesafe-ai` skill (`typesafe@typesafe-ai` v0.5.7).
Live docs (authoritative, read them): https://docs.typesafe.ai/llms.txt

- Jev returns **typed judgments + calibrated probabilities**. Three primitives:
  **Choice** (one of a defined set), **Noul** (probability a condition holds; 0.5 = genuinely split,
  NOT "medium intensity"), **Score** (probability-weighted position on ordered levels).
- **Jev cannot generate text.** No meta descriptions, no titles, no blog copy. The "select instead of
  generate" pattern applies: another model writes N candidates, Jev picks one.
- **Model**: `jev-1.13.0` (`jev-latest`). Endpoint `POST /v1/systemone`.
- **Price: $0.042 / 1M input tokens, output free** (~$0.0004/decision). Cost is not a constraint —
  403 pages × dozens of questions is cents.
- **Limits**: 64k tokens per request total (state + all questions); **32k for state + the longest
  single question**; 250k tok/s, 1200 req/min. So "put all 403 pages in one state to find
  cannibalization" is impossible — cannibalization must be **pairwise or page-vs-cluster-summary**.
- **CRITICAL for this project**: the models page states English is the primary training language and
  other languages **including CJK are "handled but not equally well; test on your own content before
  relying on Jev for a non-English workload."** DocTalk is **320/403 non-English**. Any cross-locale
  scoring scheme must validate calibration on zh/ja/ko pages first, or the numbers are not comparable
  across locales. **This is a design fork, not a footnote.**
- Ask independent questions over the same state **together** — one request, parallel, far cheaper
  (a cookbook measures 12.2× cheaper / 10× faster with identical answers).
- Keep the API key **server-side only**. Never `NEXT_PUBLIC_*`.

### Prior art (all launch-week; Jev opened early access 2026-09-15 — no production case studies exist)
- [Jev for SEO: 9 Jobs That Are Really Yes/No Questions](https://www.get-ryze.ai/blog/jev-for-seo) —
  taxonomy: internal link map (Noul), cannibalization (Noul), thin/mass-produced gate (Score),
  query→page mapping (Choice), title/intent fit (Noul), keep-update-merge-remove (Choice), redirect
  mapping (Choice), search-intent labels (Choice), **schema↔visible-content consistency (Noul)**.
  The publisher states it does not run Jev in production. Vendor benchmark: Jev 67.8% vs Claude Opus 5
  73.1% on TypeSafe's own 4-workflow benchmark — vendor-reported, not independently reproduced.
- Distribb demo: 586 pages → internal link map in 45.1s for $0.21 (vs Opus 5: 21 pages, $1.43).
  Single-source, unverified.
- Community: `pagegrade` (per-section scoring), `jev-seo` (SEO/GEO CLI + MCP), `JevSlop` (8-axis → 0-100).
- Relevant official cookbooks: `composite-scoring`, `classification_using_confidence`,
  `hierarchical_classification`, `citation_check`, `semantic_find`, `rerank_typesafe`.

---

## 6. Available instruments

- **Semrush** (Chinese white-label at `zh.trends.fast.wmxpro.com`, owner logged in, Claude drives the
  browser pane): domain overview, competitor comparison (up to 5), organic/paid traffic, backlinks,
  growth audit over 3m/6m/1y, per-country comparison, keyword topics. **Exports xls/csv.**
- **GSC** (verified) and **GA4** (`G-4JYFBL77WL`) — owner-side exports; Claude cannot sign in.
- **Production Postgres**, read-only via `railway ssh --service backend` (owner is authenticated as
  `yijiema123@icloud.com`).
- **Codex** adversarial review — mandatory for >30 lines of logic or security-adjacent changes.

## 7. Project rules the design must respect

- Verification gates: `cd frontend && npm run build`; `cd backend && python3 -m ruff check app/ tests/`;
  pytest unit + integration.
- **Never `npm run build` while the dev server runs.**
- Locale JSONs use **flat dotted keys**; a nested key breaks `next build` but NOT tsc/eslint.
- Version bump = 3 files (`version.json`, `frontend/package.json`, `package-lock.json`) — but §9.0 #3
  says **no version bump** for this branch.
- Deploy is **backend-first**; a frontend-only branch is a plain `git push origin stable`.
- Don't set cookies in `middleware.ts`; don't `await cookies()` in `app/layout.tsx` (both force
  dynamic rendering and kill SEO).

---

## 8. What Fable is asked to produce

A top-down, structured design covering at least:

1. **Goal framing.** The owner named all four success metrics. Rule on which are *decidable* at
   ~0.3 signups/day and which are merely *recordable* — §9.3 already did this for purchase.
   Say plainly what this SEO branch is allowed to claim credit for.
2. **Where Jev genuinely earns its place vs. where plain code is correct.** Mechanical defects
   (missing sitemap entries, absent JSON-LD, missing internal links) need no model. Name the
   judgments that are only tractable at scale with Jev, with the primitive for each and why.
3. **The CJK calibration fork** (§5): how to validate Jev on non-English pages before trusting any
   cross-locale number, and what the fallback is if calibration is poor.
4. **Sequencing inside the §9.0 #3 fence** (frontend-only, no version bump, separate `stable` push;
   anonymous upload + indexable share pages excluded until 09-28).
5. **Acceptance criteria** — what evidence closes each item, given GSC lag makes ranking unusable as
   a short-term gate.
6. **Whether the 09-16 `checkout_created` + the 3-of-4 zero-activity signups change the acquisition
   thesis**, and whether "both purchase intents ever recorded are upload-limit events" should steer
   which pages/keywords this branch targets.
7. **Explicit non-goals**, so Claude does not scope-creep during execution.

Deliverable: a design doc Claude can turn into an implementation plan. Flag anything you need the
owner to decide rather than guessing.
