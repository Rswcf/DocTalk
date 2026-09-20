# Design: Jev-assisted SEO optimization for DocTalk

**Author:** Fable 5.1 (design authority, per owner ruling 2026-09-03; re-confirmed 2026-09-20)
**Date:** 2026-09-20
**Executor:** Claude, then Codex adversarial review on anything > 30 lines of logic
**Inputs verified today:** `.collab/plans/2026-09-20-jev-seo-brief.md`; `.collab/plans/2026-09-03-backlog-decision.md` §9; live TypeSafe docs (`llms.txt`, `how-to-build-with-system-one`, `primitives/*`, `confidence`, `patterns/composite-scoring`, `patterns/confidence-routing`, `models`, `api`, `concepts/state`, `model-jaggedness/jev-1.13`, cookbooks `classification_using_confidence`, `entity_alignment`, `parallel_questions`); the repo at `e7db76e` (`stable` == `main`).

## 0. Rulings at a glance

| # | Question | Ruling |
|---|---|---|
| 1 | Success metrics | (a) indexation/technical health: **decidable now, mechanically**. (b) organic: **indexation of the 11 newly-listed URLs is the gate** (GSC coverage by +14d); impressions/clicks are recorded, never decided; rankings are not readable by 09-28. (c) GEO: **recordable only**. (d) ICP conversion: **not decidable at 0.31 signups/day** — record, do not decide (§9.3 already ruled purchase undecidable). |
| 2 | Where Jev is used | **Offline only**, in a Python harness under `frontend/scripts/seo/`, key from root `.env:76`, never in the request path, never in `frontend/src`. Jev is *necessary* for one job (keyword→page mapping over Semrush rows); it is *chosen for repeatability and recorded probabilities* on four others; it is *rejected* for schema↔content parity, counting, and anything numeric. |
| 3 | CJK fork | Parallel-corpus calibration with pre-registered thresholds (§5) on zh/ja/ko with de as control. A locale that fails gets **no Jev numbers**; decisions are made in EN and propagate structurally because every locale page is a translation of the EN page. |
| 4 | Sequencing | Phase 1 (mechanical, ~0 judgment) ships **first** as its own frontend-only `stable` push; it is independent of Jev and 8 days overdue. Then calibration, then audits, then a second gated push. All before 09-28; nothing touches the observed surface. |
| 5 | Title/description changes | Production changes **only on pages GSC shows at zero impressions over 28 days**. Jev-selected titles for pages with impressions are recorded as recommendations for post-09-28. Locale titles change only if that locale passed calibration **and** the owner approves. |
| 6 | Thesis | Unchanged and completed, not inverted. The 09-16 `checkout_created` confirms the button; the 3-of-4 zero-activity signups are a post-arrival problem on the observed surface (out of scope). Upload-limit purchase intents become a **tie-break weight** in keyword prioritization, not a redirection of the branch. |
| 7 | Decision date | 09-28 stands. Nothing here moves it. |

## 1. Corrections to the brief (verified against code today)

These change what Claude executes; none change the direction.

1. **`MarketingArticleJsonLd` is not caller-less, and layout-translation does not emit "no JSON-LD".** `frontend/src/lib/marketingLocalePage.tsx:60-61` renders `MarketingArticleJsonLd` whenever a caller omits the `JsonLd` prop. Exactly one caller omits it: `frontend/src/app/[locale]/features/layout-translation/page.tsx`. So the 10 locale pages emit generic **Article-only**; it is the EN root `frontend/src/app/features/layout-translation/page.tsx` that emits **nothing**. `frontend/tests/marketing-jsonld.test.cjs:226-235` explicitly pins the Article-only behaviour ("factory keeps generic Article output...without a schema override") — that test must be rewritten, not just made to pass.
2. **New gap, not in the brief: the 10 locale home pages are under-marked.** `frontend/src/app/[locale]/page.tsx` emits only WebSite + Organization. The EN root `frontend/src/app/page.tsx:68-160` emits FAQPage (6 Qs), SoftwareApplication, HowTo — all hardcoded English that today happens to equal `landing.faq.q1..a6` and `landing.howItWorks.step1..3` in `en.json`. Same defect class §9.22/§9.24 fixed elsewhere; the keys exist in all 11 locales; fixable from keys. The root SoftwareApplication also emits `dateModified: new Date()` — changes every build.
3. **§9.6's "no-signup post CTA → `/demo`" is already true.** `frontend/src/app/blog/[slug]/BlogPostClient.tsx:436,461` point to `/demo`, and the post body links `/demo` four times. Item is moot; drop it.
4. **Git topology.** `stable` == `main` == `e7db76e` (2026-09-14). `growth/acquisition-1` is fully merged (0 ahead, 18 behind) — phase 1 (`5497d6b`) and phase 2 are in production. Cut the new branch from `stable`.
5. **Prior research exists and must seed the Jev jobs, not be re-derived:** `.collab/plans/seo-deep-keywords.md` (2026-02-18; keyword universe with estimated volumes, §12 multilingual keyword tables for zh/ja/es/de/ko, §14 master keyword→page map and cannibalization rules) and `seo-competitor-analysis-2026-03.md`.
6. **All 14 `featuresLayoutTranslation.*` keys exist in all 11 locales**; the page's `tOr` fallbacks are vestigial. No translation work is needed to make those pages visible.
7. **Footer and related-link hrefs are already locale-aware** (`EditorialFooter.tsx:15` `localizedHrefIfAvailable`; every `*Content.tsx` wraps hrefs). Locale pages do receive inlinks; the `/tools` gap is a link *absence*, not a localization bug.

## 2. Goal framing — what is decidable, what is recordable, what this branch may claim

Traffic context: ~0.31 non-owner signups/day; 174 users all `free`; retention at 4+ active days = 0; GSC data lags 2-3 days.

| Owner metric | Instrument | Decidable? | Gate / read |
|---|---|---|---|
| (a) Indexation & technical health | `npm run build`, `npm run test:unit`, built-HTML verifier, Rich Results Test, GSC URL Inspection (owner), IndexNow response | **Yes, now** | Sitemap lists 414 URLs (403 + 11); every localized route has parity schema; the 11 URLs show "Indexed" in GSC by **+14d** after push #1 |
| (b) Organic traffic / impressions | GSC Performance export by page and by query (owner), Vercel Analytics / GA4 per-path (owner) | **Indexation yes; impressions no** | Record impressions at +7/+14/+28d. Low-authority feature URLs can sit at 0 impressions for months after indexing — zero is not failure. Rankings are not readable before 09-28 and must not be claimed. |
| (c) AI-search visibility (GEO) | Manual probes (ChatGPT/Perplexity/Gemini with 10 fixed queries, screenshotted), crawler UA hits in Vercel logs (GPTBot, PerplexityBot, ClaudeBot, OAI-SearchBot) | **No** | Record only. `robots.ts` already allows all AI crawlers. J6 (§4) produces a ranked readiness list for post-09-28 copy work. |
| (d) ICP-targeted conversion | GA4 source→signup, `product_events` (no `path` column) | **No** | At 4 signups in 9 days, no read is possible. Record GA4 organic-landing → `auth_provider_clicked`. §9.3's price/value row stays "record, do not decide". |

**What this branch may claim credit for:** the mechanical closure of (a), and the *existence* of indexation for the 11 invisible URLs. It may **not** claim ranking, traffic, GEO citation, or conversion effects. Any later attribution of a traffic change to this branch requires a GSC before/after with the push dates as the split, and even then only at the "recorded" level.

## 3. Where Jev earns its place vs where plain code is correct

Constraints that drive the split (from live docs, load-bearing): Jev cannot generate text; it "does not count reliably"; it "cannot reliably judge whether two values are near each other"; it reads dates as text; accuracy falls with unrelated context; `P(noul)` and `1 - P(not noul)` are not structurally comparable, so question wording must be fixed; Noul has no confidence field (use Choice/Score where confidence-routing is needed, or report |p-0.5| as the proxy); 64k tokens/request, 32k for state + longest question; 255 Choice options; 2-10 Score levels; English is the primary training language — "test on your own content before relying on Jev for a non-English workload."

### 3.1 Plain code (no model) — Phase 1

| Defect | Fix | Why not Jev |
|---|---|---|
| `/features/layout-translation` absent from `sitemap.ts` (EN + 10 locales = 11 URLs invisible since 2026-06-05) | Derive the EN entries for `LOCALIZED_PATHS` from the set itself; guard test | Set membership |
| EN layout-translation page emits no JSON-LD; locale pages Article-only | `LayoutTranslationJsonLd` mounted on both; make `JsonLd` **required** in the factory and delete `MarketingArticleJsonLd.tsx` so the class cannot recur | Type system |
| `/[locale]` home lacks FAQPage/SoftwareApplication/HowTo; EN root hardcodes them | `HomeJsonLd({locale})` from keys, mounted on both | Exact string parity; the existing test pattern already does this |
| `/tools` has zero inlinks (`sitemap.ts:64-66`, `routing.ts:63` are the only references) | Footer resources group (editorial + app), `EdRelatedLinks` on `/features/free-demo`, link on blog index | Graph edge insertion |
| Schema ↔ visible content parity | Existing `marketing-jsonld.test.cjs` + `verify-marketing-jsonld-phase2.py` (exact match, script contents stripped) | Deterministic and already stronger than any semantic judgment; the Ryze "schema consistency Noul" job is **rejected** for this site |
| Title length, keyword presence, numeric claims (50 MB, 750 pages, $9.99), volume thresholds | Code / regex | Jev does not count or compare numbers |

### 3.2 Jev jobs — Phase 3, all offline, outputs are tables and probabilities

Counterfactual stated per job: on a 53-unique-page site a human can do J3 and J4 in an afternoon; Jev is chosen there for repeatability across locales and for producing thresholded probabilities as durable data, not for speed. J1 is the job where Jev is genuinely necessary — the scale is in Semrush rows, not pages.

| Job | Primitive(s) | Necessary or chosen | Output |
|---|---|---|---|
| **J1 Keyword triage** — for each Semrush/seed keyword: which page should own it (or none), intent, heavy-document intent, ICP fit, competitor-limit intent | Hierarchical **Choice** (L1 section: home/features/use-cases/compare/alternatives/tools/pricing/blog/none → L2 page within section, second request only when L1 confidence >= 0.6); **Choice** intent {informational, commercial, transactional, navigational}; **Noul** `heavy_doc_intent`; **Choice** `icp_fit` {finance, legal, academic, general, none}; **Noul** `competitor_limit_intent` | **Necessary** — hundreds to low-thousands of rows x 53 pages | `keyword_map.csv`, `gaps.csv` |
| **J2 Title/description selection** — select-don't-generate: Claude writes 5 candidates per EN page under code constraints; Jev picks | **Noul** x3 per candidate: `intent_fit` (to J1 primary keyword), `promise_matches_page` (vs H1 + first 800 chars), `not_clickbait`; current title is candidate 0; composite 0.5/0.35/0.15 in code; keep current if within 0.05 of best | Chosen — Jev cannot write; it can rank 6 candidates consistently across 53 pages | `title_recommendations.md` |
| **J3 Blog → marketing link map** — 19 posts x 36 pages = 684 pairs | **Noul** `reader_next_step`, **Noul** `topical_match`; composite; threshold >= 0.80; top-3 per post; code de-dups against links already in the body | Chosen | `related_links.json` |
| **J4 Cannibalization on the known-risk set** (entity-alignment pattern) | **Score** 3 levels {0 different primary intents, 1 overlapping, 2 same primary intent} + **Noul** `same_audience`, `same_funnel_stage`; route by rounding to level | Chosen; GSC "two pages for one query" outranks Jev when available | `cannibalization.md` → feeds J2 differentiation |
| **J5 Claim ↔ fact-sheet consistency** — semantic claims only | **Noul** `claim_contradicts_facts` per claim-bearing sentence, fact sheet in state | Chosen; numeric claims stay regex | `claim_defects.md` |
| **J6 GEO readiness** (record only) | **Score** 0-3 "opening section is a self-contained, quotable answer"; **Noul** `standalone_answer` per FAQ answer | Chosen | `geo_readiness.md` for post-09-28 |

Rejected Jev jobs: thin/mass-produced gate (53 pages — read them), redirect mapping (no redirects exist), anchor-text variety (code counts), schema consistency (deterministic).

Cost: whole programme ~3-5M input tokens ~ **under $0.25**. Not a constraint. Batch every question that shares a state into one request (docs: 12.2x cheaper, identical answers).

## 4. The harness

Location `frontend/scripts/seo/` (Python 3; precedent: `frontend/scripts/verify-marketing-jsonld-phase2.py`, `fill_locale_translations.py`). Inside the frontend directory, so the frontend-only fence is respected literally; never imported by the app; excluded from Vercel by not being under `src/`. Outputs: raw corpus and per-request JSON under `frontend/scripts/seo/out/` (add to `.gitignore`); committed artefacts are the summary tables under `.collab/reviews/2026-09-2x-jev-seo/`.

| Module | Responsibility |
|---|---|
| `jev_client.py` | The **single place** for `MODEL = "jev-latest"`, every question text, every threshold and weight, retry with exponential backoff on 429/529, per-request `usage` logging → running cost. Reads `TYPESAFE_API_KEY` from root `.env` (parse the line; never print it). Prefer `pip install typesafe-sdk` in a local venv; `urllib` fallback against `POST https://api.typesafe.ai/v1/systemone` with `Authorization: Bearer` is acceptable (precedent in `fill_locale_translations.py`). |
| `extract_pages.py` | After `npm run build`, parse `.next/server/app/**/*.html` (all locale routes are static: `[locale]/layout.tsx` `dynamicParams=false`) with the stdlib `HTMLParser` approach from the phase-2 verifier — **script contents stripped** (the §9.24 lesson). Per URL: locale, path, `<title>`, meta description, canonical, hreflang set, H1, H2s, FAQ items, body text, word count, internal hrefs, JSON-LD types. |
| `calibrate.py` | §5. |
| `audit_keywords.py`, `audit_titles.py`, `audit_links.py`, `audit_cannibal.py`, `audit_claims.py`, `audit_geo.py` | J1-J6. Each writes a table with the raw probabilities alongside the decision so weights can change without re-inference. |
| `fact_sheet.py` | Plans and limits as code constants, sourced from `.claude/rules/frontend.md` and the pricing keys; verify `FREE_LAYOUT_TRANSLATIONS_LIMIT`'s production value before J5 runs. |

Rules: Noul instructions phrased so high = yes, one condition per Noul, `criteria.true/false` where the boundary is subtle; question IDs are for code only, so the full meaning goes in `instructions`; state is an object with named fields; only the fields the question needs (distractors degrade accuracy).

## 5. The CJK calibration fork

**Why it is a fork:** 320 of 403 pages are non-English; the vendor says CJK is "handled but not equally well"; Noul has no confidence. No cross-locale number is trusted until a locale passes.

**Design principle:** every locale page is a translation of its EN page, so the EN answer is a free reference label. Disagreement between `p_locale` and `p_en` on the same structural pair measures language degradation, not content difference. Negatives are constructed mechanically, so no hand labels are needed for the gate.

**Probe A (Choice, so confidence exists):** state `{ "title": title_L(X), "body": body_L(Y) }`, question (byte-identical English instructions across locales): *"Does the title describe the page body?"* with `criteria` `{ "describes": "...", "does_not_describe": "..." }`. Per locale L in {en, de (control), zh, ja, ko}: 34 true pairs (X=Y, all `LOCALIZED_PATHS`), 34 easy negatives (X!=Y, different section, fixed seed), 17 hard negatives (same section, e.g. `compare/chatpdf` title on `compare/humata` body). 85 pairs x 5 locales = 425 requests.

**Probe B (Noul, same pairs, same wording as a statement):** *"The title describes the page body."* Report |p-0.5| as the confidence proxy and Noul-vs-Choice AUC delta.

**Probe C (optional, owner):** 20 zh title/intent-fit items labelled by the owner; report agreement. Cheap given the owner's language; not required for the gate.

**Pre-registered gate (2026-09-20; not to be fitted after the run):** a locale is **Tier 1 (Jev-comparable)** iff all hold:
- AUC(true vs easy negatives) >= **0.90** and within **0.05** of EN's own AUC;
- AUC(true vs hard negatives) >= **0.75**;
- Spearman rho between `p_L` and `p_en` over the 85 pairs >= **0.80**;
- mean |`p_L` - `p_en`| <= **0.12**;
- mean Choice confidence on true pairs >= **0.70**.

**Tier 2 (within-locale only):** AUC criteria pass but rho or MAD fails → Jev may rank items *within* that locale; never compare its numbers with another locale's. **Tier 3 (fail):** any AUC criterion fails → no Jev audits on that locale.

**Control:** if `de` fails Tier 1, the probe is broken, not the locale — fix the probe (state fields, wording) and re-run all five before reading zh/ja/ko. If Probe B's AUC differs from Probe A's by > 0.05 for a locale, that locale's audits use `Choice {yes, no}` instead of Noul so confidence is available.

**Fallback (Tier 3 and, by default, ar/hi which are not calibrated in this pass):** decisions are made on the EN page and propagate structurally — keyword→page ownership, the link map, and the cannibalization set transfer by construction; any title/description change for that locale is a human translation of the EN decision, never a Jev-selected locale candidate. This is honest: Jev's contribution to 320 pages is then indirect, and the doc says so.

## 6. Sequencing inside the §9.0 #3 fence

Fence restated: frontend-only, no version bump (`version.json`, `frontend/package.json`, `package-lock.json` untouched), separate `git push origin stable`, no `railway up`, no `backend/` changes, no observed-surface changes (chat, reader, dashboard, billing), anonymous upload and indexable share pages excluded until 09-28 (`app/shared/[token]/page.tsx:67` `noindex` stays).

Branch: `growth/acquisition-2` **cut from `stable`** (== `main` today). If `main` gains backend commits before ship, rebase onto `stable`; never merge `main` in. Ship: fast-forward `stable`, push, then merge to `main`. Each production push is a separate owner ask.

### Phase 0 — Owner inputs (no code)
- `TYPESAFE_API_KEY` in root `.env:76` (slot exists).
- GSC exports (Performance by page, by query; Coverage) for the last 28 days as the **baseline**, before push #1.
- Semrush exports (spec in §6.3). Web-filter categorization (§9.6.0) is **still open** and nothing here substitutes for it.

### Phase 1 — Mechanical branch (ship first; independent of Jev)
1. `frontend/src/app/sitemap.ts`: generate the EN entries for every `LOCALIZED_PATHS` path from the set with a small `PRIORITY` map (default 0.7; `/` 1.0; `/demo`, `/pricing` 0.8); keep non-localized entries (about/contact/privacy/terms/blog/tools sub-pages) explicit. Keep `lastModified: generatedAt` (known non-goal, §9).
2. New `frontend/tests/sitemap-routes.test.cjs`: every `LOCALIZED_PATHS` entry appears once as EN and once per `URL_LOCALES`; every `app/[locale]/**/page.tsx` directory <-> `LOCALIZED_PATHS` in both directions; every blog post and category present.
3. `frontend/src/lib/marketingLocalePage.tsx`: `JsonLd` becomes required; delete `frontend/src/components/marketing/MarketingArticleJsonLd.tsx`; rewrite the test at `marketing-jsonld.test.cjs:226-235`.
4. `frontend/src/app/features/layout-translation/LayoutTranslationJsonLd.tsx`: `MarketingPageJsonLd` with `breadcrumbs` mirroring `LayoutTranslationPageContent.tsx:36-38`; **Article + BreadcrumbList only** (no visible FAQ, no steps — do not invent). Mount on the EN page and pass as `JsonLd` in the locale page. Add to `phase2Cases` in the test and to `PAGES` in the verifier.
5. `HomeJsonLd({locale})` (new, server component beside `app/page.tsx`): WebSite (`inLanguage`, locale root URL) + Organization; FAQPage from `landing.faq.q1..q6/a1..a6` resolving a2 with the **same** `tOr(a2, FILE_SUPPORT_FALLBACK)` as `components/landing/FAQ.tsx:7,82` (move the constant to a shared non-client module); SoftwareApplication with numeric-only offers (`0`, `9.99`, `19.99`), description `t('landing.description')`, **pinned** `dateModified`, English `featureList` dropped; HowTo from `landing.howItWorks.title` + `step1..3.title/desc`, step URL = locale root + `#how-it-works`. Replace the four hardcoded scripts in `app/page.tsx:32-160` and `websiteJsonLd` in `app/[locale]/page.tsx`. Touch only the server wrappers — never `HomePageClient`/`LandingPageContent`. Extend the test to `/` and `/[locale]` (types parity across 11 locales; FAQ entries equal the resolved `FAQ_ITEMS`; HowTo steps equal `HowItWorks` steps).
6. `/tools` inlinks: `components/landing/EditorialFooter.tsx` resources group `{ href: lh('/tools'), label: L.tools }` with `footer.links.tools` added to `i18n/chrome.ts` and **all 11 locale JSONs** (flat dotted key; Claude translates the one label); `components/Footer.tsx` resourceLinks likewise; `app/features/free-demo/FreeDemoContent.tsx:232-237` `EdRelatedLinks` add `{ href: href('/tools'), label: t('featuresDemo.cta.linkTools') }` (key x11); `app/blog/BlogIndexClient.tsx:88-97` add a `/tools` link. Anchor text: "Free document tools".
7. Gates: `cd frontend && npm run lint && npm run test:unit && npm run build` (dev server stopped), then `python3 scripts/verify-marketing-jsonld-phase2.py`; Rich Results Test on `/`, `/ja`, `/features/layout-translation`, `/ko/features/layout-translation`. Codex review (this exceeds 30 lines). Owner push #1. After Vercel "Ready": `POST /api/indexnow` (needs `AUTH_SECRET` — owner decision D3), owner resubmits the sitemap in GSC and requests indexing for the 11 URLs via URL Inspection.

### Phase 2 — Harness + calibration (no production change)
`extract_pages.py` over the Phase 1 build; `calibrate.py`; write `.collab/reviews/2026-09-2x-jev-seo/calibration.md` with the tier per locale **before** any audit runs. Codex reviews the harness (logic > 30 lines).

### Phase 3 — Audits (read-only; outputs are tables)
Run J1-J6 on EN plus Tier-1 locales; Tier-2 locales within-locale only; Tier-3 none. Semrush inputs (D5): Keyword Gap `doctalk.site` vs `chatpdf.com`, `askyourpdf.com`, `humata.ai`, `pdf.ai` (5-domain cap; NotebookLM lives on google.com — skip); Keyword Magic on the §14 seeds plus "large pdf ai", "pdf too large chatpdf", "pdf translation keep layout" and the §12 localized seeds; DBs US + JP + KR + DE + ES (CN coverage is thin — record and lean on §12); Domain Overview for `doctalk.site` (expected near-empty — record). Provenance per CSV: tool, DB, date, filter. Where exports are sparse, seed from `seo-deep-keywords.md`. Rule for conflicts: §14's assignment stands unless J1 disagrees with L2 confidence >= 0.9, and GSC ground truth outranks both.

### Phase 4 — Second frontend-only push (gated)
Contents, each owner-approved by list: (i) J2 titles/descriptions **only for EN pages at zero impressions in the 28-day GSC baseline** — pages with impressions are recorded as recommendations for post-09-28; (ii) J3 related links, implemented as a `related:` frontmatter list in the 19 posts (or `content/blog/related-links.json`) rendered by `BlogPostClient` in the existing related area (EN labels — blog is EN-only); (iii) J5 **false-claim** fixes across all 11 locales (accuracy/policy class, like §9.24's pricing FAQ). Codex review. Owner push #2. Target: before 09-28 without touching the observed surface.

### Phase 5 — Measurement (owner exports; recorded, not decided)
GSC Coverage/URL Inspection at +7/+14/+28d after push #1 (indexation gate at +14d); GSC Performance by page/query at +7/+14/+28d after each push; Vercel Analytics or GA4 pageviews for `/tools*` and `/features/layout-translation*`; crawler UA counts from Vercel logs; 10 fixed GEO probe queries, screenshotted at +28d.

## 7. Acceptance criteria — what closes each item

| Item | Evidence that closes it |
|---|---|
| Sitemap | `curl -s https://www.doctalk.site/sitemap.xml` lists 414 `<loc>` entries including `/features/layout-translation` and its 10 locale URLs; `sitemap-routes.test.cjs` green |
| Factory safety | `MarketingArticleJsonLd.tsx` deleted; `tsc` fails on a factory call without `JsonLd` (demonstrated once in review, then reverted) |
| Layout-translation schema | Test + verifier show Article + BreadcrumbList on EN and 10 locales, breadcrumbs equal the rendered trail |
| Home schema | Test shows identical type sets on `/` and 10 `/[locale]`; FAQ/HowTo entries byte-equal to rendered `t()`/`tOr()` output; Rich Results Test passes FAQPage and HowTo on `/` and `/ja` |
| `/tools` inlinks | Built HTML of `/`, `/ja`, `/features/free-demo`, `/blog` each contains an `<a href>` to `/tools` (locale-prefixed where localized); label present in all 11 JSONs |
| Indexation (metric a→b) | GSC shows the 11 URLs "Indexed" by +14d; IndexNow returned 200/202 with `submitted: 414` |
| Calibration | `calibration.md` exists **before** any audit output, with the pre-registered thresholds copied in and one tier per locale; `de` passed |
| J1-J6 | Each output table carries raw probabilities + confidence + the decision; `jev_client.py` logs total tokens and cost |
| Push #2 | Every changed title/description maps to a zero-impression page in the baseline export; every claim fix cites the fact-sheet line; all 11 locales touched for copy changes |
| Whole branch | `git diff stable..growth/acquisition-2 --name-only` contains no `backend/`, `version.json`, `package.json` version line, or observed-surface component |

## 8. Does the 09-16 data change the acquisition thesis?

**No — it completes it, exactly as §9.4-9.5 anticipated.** `checkout_created` on 09-16 (`source=upload_error`, same second as the `upgrade_click`) is the §9.3 existence read for "the button opens Stripe": confirmation, not decision. The wall moves to price/value, which stays undecidable at this traffic; no price change is authorized by one event (08-25 already ruled that out on one data point).

**The 3-of-4 zero-activity signups** are a post-arrival problem on the dashboard — the observed surface protected by §8.4 — and out of scope here. Their implication for SEO is narrow but real: more traffic into the same funnel produces more zero-activity signups, so marketing pages must not over-promise the account path. The one page known to rank (`/blog/free-ai-pdf-chat-no-signup`) is already honest (demo needs no account; upload needs one) and already routes to `/demo`. Keep it that way; do not add signup CTAs to pages that promise no-signup.

**Both purchase intents ever recorded are upload-limit events** (2026-05-06 `file_size`, 2026-09-16 `upload_error`). Two events in seven months is an anecdote, not a segment. Ruling: it becomes a **tie-break**, not a target. Concretely, J1's `heavy_doc_intent` and `competitor_limit_intent` Nouls tag keywords like "chat with large pdf", "chatpdf file size limit", "pdf too big for notebooklm"; tagged keywords get +1 priority tier in J2's primary-keyword selection for existing pages (`/features/multi-format`, the five `/compare/*` pages whose tables already carry limit rows, `/pricing`). Note that since Batch A the paid tiers actually solve the size problem (Plus 100 MB / Pro 200 MB), so "pays to upload bigger" is a real path for the first time — but a dedicated "large PDF" landing page is a **non-goal** now (no new pages; record for 09-28).

## 9. Explicit non-goals (Claude: stop if you find yourself doing any of these)

- No new marketing pages, no blog posts, no copy rewrites beyond (i) selected titles/descriptions on zero-impression EN pages and (ii) false-claim fixes.
- No locale title/description changes unless that locale is Tier 1 **and** the owner approved the list (D4).
- No `backend/` changes; no version bump; no `railway up`; no migration.
- No changes to chat, reader, dashboard, billing, pricing, or limits.
- No anonymous upload; no indexable share pages; `shared/[token]` `noindex` stays until 09-28.
- No Jev in the request path; no `NEXT_PUBLIC_*` key; no Jev-generated text anywhere.
- No cross-locale Jev comparison for any locale below Tier 1; no Jev on ar/hi in this pass.
- No hreflang code changes (`zh`, `pt` are valid ISO 639-1; `zh-Hans`/`pt-BR` would be a separate decision); `<html lang="en">` stays (spec 2026-05-24 tradeoff).
- No fix to `lastModified: generatedAt` on every sitemap entry (known inaccuracy; separate item).
- No redirects, merges, or canonical changes from J4 — differentiation only, via J2.
- No ranking, traffic, GEO, or conversion claims before 09-28; no extension of the 09-28 decision date.
- No lifecycle email; no price change; no link-building or outreach.
- No re-derivation of keyword research already in `seo-deep-keywords.md`.

## 10. Decisions the owner must make (not guessed)

| # | Decision | Recommendation |
|---|---|---|
| D1 | Ship Phase 1 as its own `stable` push before any Jev work? | **Yes** — independent, 8 days overdue, zero judgment content |
| D2 | GSC/GA4 export set and cadence (baseline now; +7/+14/+28d) | Owner exports; Claude cannot sign in |
| D3 | Who fires `POST /api/indexnow` (needs production `AUTH_SECRET`) and requests indexing in GSC for the 11 URLs | Owner, immediately after Vercel "Ready" |
| D4 | Permission to change locale titles/descriptions before 09-28 for Tier-1 locales | Default **no**; EN zero-impression pages only |
| D5 | Semrush databases and exports (US/JP/KR/DE/ES; Keyword Gap vs 4 competitors; Keyword Magic seeds) | As specified in §6.3 |
| D6 | Optional 20-item zh label set for Probe C | Cheap; recommended |
| D7 | Web-filter categorization submissions (§9.6.0) | Still open; nothing in this branch substitutes |
| D8 | Approve the Phase 4 change list (titles, links, claim fixes) page by page | Required before push #2 |

## 11. What would make me re-rule

`de` fails calibration twice after a probe fix (then Jev is not usable on this corpus at all and Phase 3 collapses to J1 on EN only); GSC baseline shows impressions on many more pages than assumed (then Phase 4's zero-impression set may be near-empty and the branch ends at push #1 plus recorded recommendations); or the owner moves the 09-28 date.

---

## 12. Owner overrides (2026-09-20, recorded by Claude)

The owner answered D1, D4 and D7 **against** Fable's recommendation in each case. The owner's
ruling stands over the design author's. Recorded here so no later reader mistakes §0/§10 for the
operative plan.

| # | Fable's recommendation | Owner's decision | Consequence |
|---|---|---|---|
| D1 | Ship Phase 1 mechanical fixes first, as their own `stable` push | **Build Jev first, ship everything in one push** | The 11 invisible URLs stay invisible until the combined push. The "+14d indexation" gate — the only metric §2 rules decidable — now risks landing after 09-28. Phase 1 code is still written first (Phase 2's `extract_pages.py` parses the Phase 1 build), it is simply not pushed on its own. |
| D4 | No locale title/description changes before 09-28; EN zero-impression pages only | **Allowed, automatic by threshold** (Tier-1 locale + zero-impression page → change it) | Removes the per-item owner gate for Tier-1 locales. **Blocked on D2**: the threshold is "zero impressions in the 28-day GSC baseline", and that export does not exist yet. Until D2 is delivered there is no zero-impression set and no change may be made under this rule. |
| D7 | Owner items (web-filter categorization) first — "nothing below substitutes for them" | **Deferred; do SEO first** | §9.0 #3's stated order is inverted. DocTalk stays blocked on enterprise gateways whose users are exactly the ICP. Not a code dependency; carried as an open owner item. |

Everything else in §0-§11 stands as written.

### Revised execution order under D1

1. Phase 1 code on `growth/acquisition-2` (cut from `stable`) — **no push**.
2. Phase 2 harness + CJK calibration against the Phase 1 build.
3. Phase 3 J1-J6 audits.
4. Phase 4 content changes (title/description changes gated on the D2 export).
5. One combined frontend-only push, Codex-reviewed, owner-authorized.
