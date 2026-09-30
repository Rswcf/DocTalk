# DocTalk search + answer-engine audit — design for the executor (2026-09-30)

Author: Fable 5.1 (design). Executor: Claude, driving the owner's Semrush session at `zh.semrush.fast.wmxpro.com`, the signed-in Google Search Console, curl, squirrelscan, PageSpeed Insights, and the browser for AI engines. Read-only design; nothing below modifies files. Evidence the executor produces goes under `.collab/reviews/2026-09-30-seo-audit/` (report + `evidence/` with CSV exports and screenshots), one file per numbered step, named by the step ID below.

## 0. Read this first — what the Gate-0 data already decided

The question the owner asked is "our traffic stopped; are search engines and AI engines failing to reach us?" The data that arrived while this was being designed answers the first half before any audit runs:

| Fact (source) | Consequence |
|---|---|
| GSC, `https://www.doctalk.site/`, web search, 2026-02-13 → 09-27: 214 clicks / 28.6K impressions in 16 months; weekly clicks ranged 2–16, never more; last four weeks 7, 5, 12, 8 | **Google organic never delivered more than ~1–2 visits/day.** August's 17 signups (0.55/day) cannot have come from 12–16 Google clicks/week unless 30–50 % of clicks converted. There is no Google click cliff to find. |
| Impressions peaked 08-02/08-09 (~2.5–2.6K/week) and fell ~70 % to 744 by the 09-20 week while weighted position improved 16 → 8.7; the top queries by impressions are long zero-click questions ("can document assistants provide citations for every answer", 426 impr) | The site lost *low-position, zero-click* visibility. Whether that is an AI-surface artifact or a ranking loss is testable (G0-D below) — but either way **no clicks were lost**, so it is not the owner's problem. |
| "doctalk ai" position 2.1, 12 clicks / 42 impressions; "doctalk" position 19.7, 8 clicks / 347 impressions | The disambiguated brand term is won; the head term is lost to the other DocTalk entities and carries ~22 impressions/month for *our* entity. **There is no brand channel to lose.** The Feb 2026 disambiguation plan (`seo-deep-offpage.md` §6) is confirmed, not reopened. |
| Semrush Domain Overview US, 09-29: organic traffic 0 (-100 %), 29 keywords (-34 %), AS 6, referring domains 231 (191 on 09-19), backlinks 367 | The spam campaigns added ~40 domains after the 09-20 disavow; they are not in the file. One addendum is needed, then stop. |
| Semrush AI visibility: 14 mentions / 1 cited page (ChatGPT 4, AI Overviews 4, Gemini 2) via wisdomquant.com, pdnob.com, effortlessacademic.com; 0 on 09-19 | Treat as **first measured**, not growth — the toolkit typically starts collecting when first opened for a domain. The three listicles are the only earned-media surface DocTalk has. |
| Own DB (readout 09-22): 5 non-owner signups in 16 days (0.31/day); 34 anonymous demo sessions; 3 uploads; zero non-owner *active* users since 09-07 | Arrivals fell 0.55 → 0.31/day; the collapse is in *activation*, which is a product problem already owned by the 09-22 strategy. Whether the arrival drop is even outside Poisson noise is G0-B. |

So the audit has two jobs, and the report must keep them apart:

1. **Channel attribution (the owner's actual question).** Which non-Google channel produced arrivals in May–August, and did it stop? This is Gate 0, Phase 1, and it is mostly GA4 + DB + backlink-delta work, not Semrush keyword work.
2. **"Never had a search/AEO channel" audit (the owner's framing).** Why does an indexed, correctly targeted, technically clean 405-URL site get 8 Google clicks/week and 14 AI mentions? This is the question tree in §3, run as a delta over the Feb and 09-20 work.

The report's headline is allowed to be: "No proven cause of a traffic cliff; Google organic was never the channel; the channel that fed August was X (or: could not be attributed because consent-gated analytics cover N % of visits)."

## 1. Delta ledger — what prior work already settled

| Area | Last verified (file, date) | Status today | What this audit does |
|---|---|---|---|
| Home page SSR, server metadata, JSON-LD parity across 11 locales, sitemap derived from `LOCALIZED_PATHS`, per-locale SEO meta keys | `.claude/rules/frontend.md` "Sitemap & Structured Data" (09-20/09-21); tests `sitemap-routes`, `seo-meta-keys`, `marketing-jsonld`; `verify-marketing-jsonld-phase2.py` | **Settled structurally** (build-time tests) | One production spot-check per template (S-1.4), no re-audit |
| Keyword universe, intent map, keyword→page mapping, cannibalization rules | `seo-deep-keywords.md` §1–14 (02-18); `findings.md` §2–6 (09-20: "pages correctly targeted") | **Settled** | Not redone. Only new keyword work: zh/es DB lookup for the five academic terms (S-2.5) |
| Competitor gap (chatpdf, humata; askyourpdf dropped) and the winnable set; legal/finance absent from the gap | `findings.md` §3, §A, §B (09-20, full 1,053-row corpus) | **Settled** | Not redone |
| Backlink profile toxic, 188-domain disavow uploaded, property is URL-prefix only, non-www variants uncovered | `findings.md` §C; memory `seo-spam-backlinks-2026-09-20`; owner-actions §3 | **Stale by 10 days** — 191 → 231 domains | Delta pull + addendum file (O-3); Domain-property check (owner) |
| Brand collision / entity disambiguation | `seo-deep-offpage.md` §5–6 (Feb); GSC 09-30 | **Settled by GSC** ("doctalk ai" pos 2.1) | One line in the report; Organization `sameAs` gap noted (A-2.2) |
| Feb technical audit findings (CSR home, no hreflang, 5-URL sitemap, `lang="en"`, middleware) | `seo-technical-audit.md`, `seo-deep-technical.md` (02-18) | **Superseded** by 02-18 SSR overhaul, 04-13 CDN-cache fix, 05-24 locale URLs; `<html lang="en">` on all locales is an accepted tradeoff (spec 05-24) | Not re-verified except via the indexing check (S-1.2) which is the only place it could matter |
| Locale sitemaps submitted to GSC and Bing (Phase C, owner-manual) | `2026-05-24-international-seo-locale-urls-spec.md` :112; memory `international-seo-phase-a` | **Never verified** | GSC Sitemaps report (S-1.3); Bing WMT or `site:` (S-1.5) |
| The 11 layout-translation URLs made visible 09-20 — "indexed by +14 d" gate | `2026-09-20-jev-seo-design.md` §7 | **Never read** (due ~10-05) | URL Inspection on 3 of the 11 (S-1.2) |
| GEO/AEO recommendations (Feb): comparison tables, schema, Bing submission, third-party listings, `CCBot` | `seo-deep-international.md` §9–11 | **Never measured** until Semrush AI toolkit 09-29 | Full AEO protocol (§5) |
| Enterprise web-filter categorisation (site blocked as "Unknown" behind Zscaler-class gateways) | memory `topdown-review-2026-08-25`; owner-actions §2 | **Open, owner-only, third ask** | Not an SEO item; listed once in §7 as a constant (cannot explain a *change*) |
| `/document-diff` Disallowed although it uses `MarketingShell` | `frontend/src/app/robots.ts:3`; `frontend/src/app/document-diff/page.tsx:20-24` redirects unauthenticated visitors to `/auth` and renders the app diff panel | **Settled by code: intended.** It is an authenticated tool in a marketing shell, not a marketing page | No action |
| CWV: mobile LCP 3192 → 2872 ms after Fraunces preload removal | `.collab/reviews/2026-09-21-v0.32-seo-impact.md`; `scripts/design-audit/cwvcheck.mjs` | **Current** | One PSI run per template for the record (S-2.7); not a ranking cause at AS 6 |
| Analytics coverage | `frontend/src/components/AnalyticsWrapper.tsx:24-35`: GA4 **and** `@vercel/analytics` load only after cookie consent `accepted`; `frontend/src/lib/analytics.ts:10-27`: `trackEvent` always POSTs to `/api/proxy/api/events` with `path`, no referrer/UTM | **Newly relevant** — both web analytics tools are consent-gated samples; server-side `product_events` is the only un-gated series | Gate 0 uses `product_events` + `sessions` + `users` as the denominator for GA4 coverage (G0-C) |

## 2. Gate 0 — revised, with the data now in hand

Every step has a pre-registered rule. Record the result before reading the next step; do not fit rules after the fact.

### G0-A. Was Google organic ever a channel? — DECIDED: no

Rule (pre-registered): a channel needs ≥ 50 clicks in at least one week. Observed max 16. **Killed.** No executor time. The report states it with the weekly table from the coordinator's pull (executor re-exports it as `evidence/G0-A-gsc-weekly.csv` for provenance: GSC → Performance → Search results → Date: Last 16 months → Compare off → Export CSV, sheet "Dates").

### G0-B. Did arrivals actually drop beyond noise? — owner SQL, 5 min

Data: `users.created_at` by ISO week, split into activated (≥ 1 document or ≥ 1 user message) vs not. Owner runs SQL-1 in §7 (Claude cannot read production; if the 09-22 read-only role now exists, the executor runs it).

Rule: compare the last 4 full weeks (09-01 → 09-28) against the prior 8 weeks (07-06 → 08-31) on the **activated** series (the 09-20 brief showed 3 of 4 September signups had zero activity; August's 17 may contain the same junk, and a channel drop only counts on humans). Compute the Poisson rate ratio with a 95 % CI (exact or Byar). CI excludes 1 → "real drop"; CI includes 1 → "not distinguishable from noise" — still run G0-C because the owner perceives it, but the report says so.

Cheap sanity numbers already known: August all-signups 17/31 d = 0.55/day; 09-11 → 09-27 5/16 d = 0.31/day; expected 8.8 at the August rate, observed 5, one-sided p ≈ 0.12. On *all* signups this is not significant. The activated series may be.

### G0-C. Which channel produced the arrivals, and which stopped? — executor 1.5 h + owner SQL

Un-gated series first (owner SQL-2 and SQL-3): weekly `landing_cta_clicked`, `auth_modal_opened`, `auth_provider_clicked` from `product_events` (non-owner, `user_id` null included), and anonymous demo sessions/week (`sessions.user_id is null`). These are the denominators.

Then the consent-gated sources, in this order:

| Source | Access check | Pull | Use |
|---|---|---|---|
| GA4 property `G-4JYFBL77WL` | Open `https://analytics.google.com` in the executor's browser — the GSC login is a Google account, so GA4 is probably signed in too. If not: owner export (§7 item 2) | Reports → Acquisition → Traffic acquisition; dimension "Session source / medium" (and "Session default channel group"); date 2026-02-13 → 09-28; add secondary dimension "Week"; export. Also Engagement → Events → `auth_provider_clicked` / `landing_cta_clicked` by source/medium if the custom events are visible | Channel share per week among consenting visitors |
| Coverage ratio | — | GA4 weekly sessions on marketing paths ÷ un-gated proxy (`landing_cta_clicked` + demo sessions) per week | If the ratio is < 0.3 or swings > 2× week to week, GA4 channel shares are reported with that caveat and cannot alone name a channel |
| Vercel Web Analytics | `https://vercel.com` — probably not signed in; skip if not | Analytics → Referrers, Aug vs Sep | Corroboration only (same consent gate) |
| Semrush Backlink Analytics → Backlinks, filter "Lost", date 2026-07-01 → 09-29; and Referring domains sorted by "First seen" desc | Semrush | Export | A **lost earned link** (a listicle dropping DocTalk, a directory unpublishing) is the one off-site mechanism that could produce a cliff. Among the 3–6 earned domains (github.com, parse.gl, the vercel preview, plus wisdomquant/pdnob/effortlessacademic if they link), any "lost" row is a proven-mechanism candidate |
| Own recollection | Owner (§7 item 5) | Where DocTalk was posted May–Aug (Product Hunt, Reddit, V2EX, Zhihu, X, GitHub README, chat groups) and the last date | The most likely August channel for a 0.5/day product is the owner's own promotion; it has no analytics trace |
| GitHub `Rswcf/DocTalk` | Only if the browser is signed in to GitHub; Insights → Traffic covers 14 days only | Referring sites, views | Low value; skip unless free |

Rule: a channel is named as "the one that stopped" only if (i) it held ≥ 30 % of Jul–Aug sessions in GA4 *and* (ii) fell ≥ 70 % in September *and* (iii) one corroborating trace exists outside GA4 (a lost link, a listing page that no longer shows DocTalk, an owner-confirmed end of posting, or a matching drop in the un-gated series on the same weeks). Two of three → "correlated". GA4 alone → "hypothesis".

Fingerprint fallback if GA4 is unavailable or covers < 30 %: SQL-1's provider × email-domain-class × activated cut. A burst of `qq.com`/`163.com` signups points to a Chinese community post; `.edu`/`.ac.xx` to an academic listing; Microsoft-provider signups to enterprise; gmail-only zero-activity signups to bots or directory-driven drive-bys.

### G0-D. What is the Aug → Sep impression decline? — executor 45 min, GSC

Pull: Performance → Search results → Queries, date 2026-08-01 → 08-31 vs 2026-09-01 → 09-27 (Compare), export both (≤ 1000 rows each; the property has 990 query rows over 16 months so nothing is cut). Same for Pages and Countries. Also Search appearance (any rows at all?).

Bucket queries by word count: short (≤ 3 words), medium (4–5), long (≥ 6 words, natural-language questions). Sum impressions and clicks per bucket per period.

Rules:
- If ≥ 60 % of the impression loss sits in the long bucket and clicks in that bucket were ≤ 5 in August → **"lost zero-click visibility; not actionable; mechanism unproven"**. The AI-surface explanation (AI Overviews / AI Mode impressions are reported inside Web search and GSC exposes no filter for them; ~6-word question queries at position 8–15 with 0 clicks are the signature) is recorded as **correlated**, never proven — GSC cannot separate it.
- If the loss is in the short/medium bucket on `/blog/ai-research-paper-summarizer` or the use-case pages → ranking loss; cross-check with Semrush Organic Research → Position Changes → "Lost" and "Declined", compare 2026-08-19 vs 2026-09-29 (S-2.3). Timing against the deploy line: the decline starts the 08-16 week — after 08-04 v0.28.0, before 09-20/21/22. v0.28.0 (fonts/glass) is the only deploy inside the window; it changed no titles, URLs or markup (`git log` shows no SEO commits between 08-08 and 09-08), so it is at most "correlated by timing"; note it and move on.
- Pages view: if the loss is concentrated on one URL, name it.

### G0-E. Was there a Google penalty or a Discover/News burst? — executor 5 min, GSC

Security & Manual Actions → both reports: "No issues detected" **kills** the penalty hypothesis; the spam links are then "devalued or ignored" per Google's post-Penguin-4.0 policy, as the 09-20 report already framed. Performance → Discover and → Google News tabs: if either exists with any clicks in Jul–Aug, that is a real burst-that-ended candidate (Discover traffic is spiky and is not in the 28.6K). Absent tabs → killed.

### G0-F. Crawl continuity across the 09-21 / 09-27 deploys — executor 5 min, GSC

Settings → Crawl stats: 90-day total requests, by response, by purpose, by Googlebot type, host status. Rule: a ≥ 50 % drop in daily requests persisting > 7 days after 09-21 (Night) or 09-27 (R2, 0.33–0.35) → open a technical branch (S-1.1). Otherwise killed. R2 is object storage for uploaded documents and is not on any marketing route (`next.config.mjs` only adds it to `connect-src`), so the prior is "no effect".

### Branching after Gate 0

- **Real drop + named channel (G0-B real, G0-C three-of-three):** the report's core is the channel mechanism and its restoration; the §3 tree runs in **compressed form** (Phase 2 lanes at half depth, AEO probes reduced to the 8 English category queries) because the owner's question is answered.
- **Real drop + no channel attributable:** full tree; the report says plainly that consent-gated analytics cannot attribute and recommends the one instrumentation fix that would (store `document.referrer` and `utm_*` in `metadata_json` on first `landing_cta_clicked` / `auth_modal_opened` — a 5-line frontend change, out of this audit's scope).
- **Not a real drop:** full tree; the report reframes the owner's question as "build a channel", and the §8 prioritisation weights AEO and the zh/es cluster over anything technical.

## 3. The question tree (MECE)

**Search (Google, Bing and what feeds them)** — why do search engines deliver ~1 visit/day?

- S-1 Cannot be crawled or indexed
  - S-1.1 Crawler blocked, challenged, or served an empty shell (robots, Vercel bot protection, CSP, JS-only content)
  - S-1.2 Crawled but not indexed / Google chose a different canonical (locale pages, the 11 layout-translation URLs, blog)
  - S-1.3 Discovery: sitemap not read, not submitted, stale lastmod
  - S-1.4 Duplicate hosts: `doctalk-liard.vercel.app`, non-www, http
  - S-1.5 Not in Bing's index (which also feeds ChatGPT search, Copilot, DuckDuckGo)
- S-2 Indexed but does not rank
  - S-2.1 No authority: AS 6, 3–6 earned links, 200+ spam domains (settled; delta only)
  - S-2.2 Spam links suppressing rather than ignored (unproven either way — G0-E is the test)
  - S-2.3 Lost the one ranking cluster (blog post at 62–93; `demo document` #6)
  - S-2.4 Content-query fit (settled 09-20 as correct — not reopened)
  - S-2.5 Locale pages not served in their markets (zh in HK/TW/SG/US-zh SERPs; es in ES/MX; ja in JP)
  - S-2.6 Site-quality signals: 330 of 405 URLs are translations; thin-per-URL risk shows up as "Crawled – currently not indexed" in S-1.2, not as a separate test
  - S-2.7 Technical/CWV (record only)
- S-3 Ranks but is not clicked: queries with impressions ≥ 50 at position ≤ 10 and CTR < 1 %; title/snippet rewritten by Google
- S-4 Clicked but does not convert to signup: `landing_cta_clicked` / `auth_modal_opened` per marketing path per week; Night (09-21) before/after
- S-5 Brand / entity: "doctalk" head term lost to doctalk.chat / doctalk.com / Charité (settled: no channel to lose); "doctalk ai" won; Organization entity signals thin (`sameAs` = GitHub only, `HomeJsonLd.tsx:47`, `about/page.tsx:34`)

**AEO (ChatGPT, Perplexity, Google AI Overviews/AI Mode, Copilot, Gemini)** — why 14 mentions and 1 cited page?

- A-1 Not in the engines' retrieval indexes (Bing for ChatGPT/Copilot; Google for AIO/AI Mode/Gemini; Perplexity's own crawl) — shares S-1.5 and S-1.2
- A-2 Not a recognised, trustworthy entity: no Wikipedia/Wikidata, `sameAs` only GitHub, brand name collides with three other DocTalks, no third-party reviews (G2/Capterra/PH)
- A-3 Content not extractable or citable: answer-first paragraphs, FAQ and comparison tables present in initial HTML; `llms.txt` inventory vs sitemap; AI crawler access (`GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `ClaudeBot`, `Claude-User`, `Claude-SearchBot`, `Google-Extended`, `Bingbot`, `CCBot`, `Applebot`, `DuckAssistBot`, `meta-externalagent`, `Amazonbot`, `Bytespider`)
- A-4 Not present on the third-party sources the engines cite for category queries (the earned-media gap: which domains each engine cites for "best AI PDF chat", and whether DocTalk is on them)
- A-5 Brand branch for AEO: does "what is DocTalk" return *our* product or the healthtech/Charité entities?

## 4. Leaf hypotheses — evidence, tool, runner, decision rule

Runner: E = executor (Claude), O = owner. "Semrush path" = the standard Semrush route; the reseller mirrors Semrush's routes under `zh.semrush.fast.wmxpro.com` — if a path 404s, reach the report through the left navigation (Chinese labels given in brackets) and record the URL actually used in the evidence log. **Never create Semrush Projects** (Site Audit, Position Tracking, Backlink Audit) on the reseller account even if the UI allows it — it is a shared account and project slots and data are visible to other tenants; treat project tools as unavailable by design.

### S-1 Cannot be crawled / indexed

| ID | Hypothesis | Evidence that confirms / kills | Tool + exact parameters | Runner | Decision rule |
|---|---|---|---|---|---|
| S-1.1 | A crawler is blocked, challenged, or gets a shell | UA matrix: `curl -sS -A "<UA>" -o /dev/null -w "%{http_code} %{size_download} %{content_type}\n"` plus a second call saving the body and grepping for `<h1` and the first FAQ answer text, for 6 URLs (`/`, `/zh`, `/es/use-cases/students`, `/compare/humata`, `/blog/ai-research-paper-summarizer`, `/features/layout-translation`) × 8 UAs (Googlebot desktop, Googlebot smartphone, Bingbot, GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, plain curl). Record `x-vercel-cache`, `cache-control`, and any `x-vercel-challenge`/interstitial | curl | E, 20 min | Any non-200, any body without `<h1`, or `cache-control: private, no-store` on a marketing route → **proven** blocker (mechanism visible), open a fix item. All 200 with full HTML → killed |
| S-1.2 | Locale pages / the 11 layout-translation URLs / blog posts are not indexed or canonicalised elsewhere | GSC → Indexing → Pages: indexed count vs 405; every "Why pages aren't indexed" reason with counts; export each reason's URL list. URL Inspection on 12 URLs: `/zh`, `/zh/use-cases/students`, `/es/use-cases/students`, `/ja/compare/askyourpdf`, `/ko/features/citations`, `/features/layout-translation`, `/zh/features/layout-translation`, `/ko/features/layout-translation`, `/compare/humata`, `/alternatives/chatpdf`, `/tools`, `/blog/ai-research-paper-summarizer` — record "URL is on Google", user-declared vs Google-selected canonical, last crawl, referring page | GSC | E, 45 min | Indexed ≥ 80 % of sitemap URLs and the 12 inspections show self-canonical → killed. Locale URLs ≥ 50 % "Crawled – currently not indexed" or "Duplicate, Google chose different canonical" → **proven** (reason string is the mechanism); this reorders the 09-22 §2.2 zh/es plan and is the highest-impact finding the audit can produce. Layout-translation URLs not indexed → the 09-20 "+14 d" gate failed; record |
| S-1.3 | Sitemap not submitted / not read / stale | GSC → Indexing → Sitemaps: which sitemaps, status, last read, discovered URLs. `curl -s https://www.doctalk.site/sitemap.xml \| grep -c "<loc>"` (expect 405) and `grep -c "<xhtml:link"` (expect 12 per localized URL). Note: `lastmod` = build time for all non-blog entries (`sitemap.ts:83`) — known, low priority | GSC + curl | E, 10 min | Sitemap absent or "Couldn't fetch" → proven discovery defect (owner submits). Present, read after 09-22, 405 discovered → killed. lastmod issue recorded as P3 |
| S-1.4 | Duplicate hosts indexed | `curl -sI https://doctalk-liard.vercel.app/` and `curl -s https://doctalk-liard.vercel.app/ \| grep canonical`; Google `site:doctalk-liard.vercel.app`; `site:doctalk.site -inurl:www` | curl + browser | E, 10 min | Preview host indexed with self-canonical → proven duplicate; fix = `X-Robots-Tag: noindex` when `VERCEL_ENV !== production` (out of audit scope, record). Canonical points at www or 0 results → killed. The 2-hop 308 chain is not investigated |
| S-1.5 | Not in Bing's index (feeds ChatGPT search, Copilot, DDG) | Access check: open `https://www.bing.com/webmasters` — a `msvalidate.01` meta exists (`layout.tsx:87`) so a property was verified in Feb. If signed in: Search performance (6 months clicks/impressions), Sitemaps (submitted? last processed?), URL inspection on `/zh` and `/compare/humata`, IndexNow (submitted URL count), Site Scan summary, Backlinks count. If not signed in: `site:doctalk.site` on bing.com (record the count), `site:doctalk.site/zh`, `site:doctalk.site/es`, `site:doctalk.site "DocTalk vs Humata"`; DuckDuckGo `site:doctalk.site`. Key-file check `curl https://www.doctalk.site/38e9d0db4a654c64b237039b2ac0af5d.txt` | Bing WMT or browser + curl | E, 20 min (+ O if not signed in) | Bing `site:` ≥ 200 results incl. locale URLs → killed. < 50 or no locale URLs → proven Bing coverage gap; fix = owner submits sitemap in Bing WMT and fires `POST /api/indexnow` once (§7 item 6). This single check answers both "other search engines" and the largest AEO retrieval question |

### S-2 Indexed but does not rank

| ID | Hypothesis | Evidence | Tool + parameters | Runner | Decision rule |
|---|---|---|---|---|---|
| S-2.1 | Authority unchanged; any *new earned* links since 09-19? | Backlink Analytics → Referring domains [引荐域名], `q=doctalk.site`, sort First seen desc, filter Active; export. Classify with the existing `frontend/scripts/seo/build_disavow.py` anchor patterns (spam campaign anchors vs other). Open the three AI-cited pages (wisdomquant.com, pdnob.com, effortlessacademic.com), find the DocTalk mention, record whether it is an `<a href>` to doctalk.site and rel attributes | Semrush path `/analytics/backlinks/refdomains/?q=doctalk.site&searchType=domain`; browser | E, 40 min | Earned domains (non-campaign anchors, AS > 10 or editorial context) ≥ 3 new → note as the only positive authority signal. Otherwise settled: AS 6 stands; not a finding, a constraint |
| S-2.2 | Spam links suppress rather than get ignored | Killed or kept alive by G0-E (Manual actions) plus one timing test: GSC Pages → `/blog/ai-research-paper-summarizer` impressions by week around 06-28 (campaign 1 start) and 09-11 (campaign 2 start). The coordinator's weekly table already shows impressions *rising* into August after 06-28 | GSC | E, 10 min | No manual action AND impressions rose after 06-28 → **killed as a cause**; the addendum disavow (O-3) is hygiene, not a fix. Do not spend more time |
| S-2.3 | The one ranking cluster was lost | Semrush Organic Research → Position Changes [排名变化], `q=doctalk.site&db=us`, compare 2026-08-19 vs 2026-09-29 (or nearest available dates), tabs Lost / Declined / New / Improved; export. Fallback if locked: Organic Research → Positions [排名] export now, diff against `frontend/scripts/seo/data/organic_positions_us_20260919.csv`. Cross-check GSC Pages compare Aug vs Sep for the same URLs | Semrush path `/analytics/organic/positionsChanges/?q=doctalk.site&searchType=domain&db=us` | E, 30 min | ≥ 10 lost keywords on one URL that GSC also shows losing impressions in the short/medium bucket → correlated ranking loss on that URL; PROVEN only if a mechanism is found (e.g. the page's title/H1 changed on 09-21/22 — check `git log -p` for that page) |
| S-2.5 | Locale pages are not served in their markets | Domain Overview [域名概览] → Worldwide tab: keywords by country database (one screenshot). Then Organic Research Positions for `db=hk`, `tw`, `sg`, `jp`, `kr`, `de`, `es`, `mx`, `br`: count rows and list any locale URL. Keyword Overview [关键词概览] bulk for `学术ai`, `论文ai`, `读论文 ai`, `文献阅读`, `ia para investigar gratis` with database "All" to see where volume sits. Browser SERP check: `google.com/search?q=读论文+ai&hl=zh-TW&gl=TW&pws=0&num=100` (and `gl=HK`, `gl=SG`, `gl=US&hl=zh-CN`), `google.es/search?q=ia+para+investigar+gratis&hl=es&gl=ES&pws=0&num=100`: is any doctalk.site URL in the top 100, and which one | Semrush paths `/analytics/overview/?q=doctalk.site&searchType=domain&db=us` (Worldwide), `/analytics/organic/positions/?q=doctalk.site&searchType=domain&db=<db>`, `/analytics/keywordoverview/?q=<kw>&db=<db>`; browser | E, 45 min | Any locale URL ranking top 100 in its market → the zh/es plan has a foothold; record positions as the baseline for the 09-22 §2.2 metric. None, and S-1.2 shows them indexed → authority only (expected). None and S-1.2 shows them not indexed → S-1.2's finding governs |
| S-2.7 | Technical / CWV | `squirrel audit https://www.doctalk.site -C full --format llm` once; PSI API mobile+desktop for `/`, `/zh`, `/compare/chatpdf`, `/blog/ai-research-paper-summarizer`. GSC → Experience → Core Web Vitals (field data; expect "not enough data") | squirrelscan, PSI | E, 30 min | Only **error-class** squirrelscan rules that name crawl/index/canonical/hreflang/robots/duplicate defects are findings; score is ignored. CWV "poor" in field data → P2; lab-only → record |

### S-3 Ranks but is not clicked

| ID | Evidence | Tool | Runner | Rule |
|---|---|---|---|---|
| S-3.1 | GSC Queries, last 3 months, filter impressions ≥ 50, sort CTR asc; for the top 10 open the live SERP (`&pws=0&gl=us&hl=en`) and record whether Google rewrote the title, which SERP features sit above, and whether the query is navigational to a competitor | GSC + browser | E, 30 min | A query with ≥ 200 impressions/month at position ≤ 10 and CTR < 1 % where the rendered title is not ours → a title/snippet finding (impact capped at a few clicks/week; say so). Otherwise killed: total clicks are 8/week and CTR work cannot move the owner's metric |

### S-4 Clicked but does not convert

| ID | Evidence | Tool | Runner | Rule |
|---|---|---|---|---|
| S-4.1 | SQL-4 (§7): `landing_cta_clicked` and `auth_modal_opened` by `metadata_json->>'path'` by month since May; and per week for 4 weeks before / after 09-21 (Night) | Owner SQL (or executor via read-only role) | O 2 min | If `path` is null in `metadata_json`, the events allowlist dropped it — report that as an instrumentation gap. Night before/after is recorded only; at ~10 CTA clicks/week no read is decidable (the 09-22 strategy already ruled this) |

### S-5 Brand / entity

| ID | Evidence | Tool | Runner | Rule |
|---|---|---|---|---|
| S-5.1 | Settled by GSC: "doctalk ai" 2.1, "doctalk" 19.7 with ~22 impr/month for our entity. One confirming SERP screenshot each (`&pws=0&gl=us`) and one for `doctalk pdf` | Browser | E, 5 min | No further work. The Feb recommendation "always say DocTalk AI externally" stands |
| S-5.2 | Entity signals: `HomeJsonLd.tsx` Organization `sameAs` = GitHub only; no Product Hunt / Crunchbase / LinkedIn / X profile exists to add? Executor checks which of these profiles exist (search `"doctalk.site" site:producthunt.com`, `site:alternativeto.net`, `site:theresanaiforthat.com`, `site:futurepedia.io`, `site:g2.com`, `site:capterra.com`) | Browser | E, 15 min | Existing profiles not in `sameAs` → P3 code item (5 lines). No profiles → the A-2/A-4 earned-media finding, owner-only and outside the "owner only writes code" constraint; list once in §7 without a programme |

### A — AEO leaves (measurement protocol in §5)

| ID | Hypothesis | Evidence | Rule |
|---|---|---|---|
| A-1 | Retrieval index gaps | S-1.5 (Bing) and S-1.2 (Google) results; Perplexity: run `site:doctalk.site` inside a Perplexity query ("what does doctalk.site say about citations") and see whether it fetches our page | Bing gap → proven for ChatGPT/Copilot; Perplexity fetch fails with 200 pages in S-1.1 → record |
| A-2 | Entity not trusted | S-5.2; brand probes P-B1..B4 in §5; Google `"doctalk.site" -site:doctalk.site` result count; `"DocTalk" "chat with" pdf -site:doctalk.site` | Brand probes returning the healthtech/Charité entity → proven collision in AEO (mechanism: entity resolution); mitigation is the Feb "DocTalk AI" naming plus `sameAs`, both recorded |
| A-3 | Not extractable | From S-1.1 bodies: is the answer-first paragraph, the FAQ Q/A text and the comparison table (`/compare/humata`) present in the initial HTML? `llms.txt` diff: list every sitemap EN URL not in `frontend/public/llms.txt` (expected missing: `/trust`, `/features/layout-translation`, `/features/performance-modes`, `/use-cases`, `/compare`, `/alternatives`, `/features` hubs, `/demo` vs `/features/free-demo`); `curl -A GPTBot https://www.doctalk.site/llms.txt` 200. Rich Results Test on `/`, `/zh`, `/compare/humata`, `/blog/ai-research-paper-summarizer` | All content in HTML, schema valid → killed as a cause (the site is extractable; the deficit is A-2/A-4). Missing → P2 code items |
| A-4 | Absent from the sources engines cite | The cited-domain frequency table from the category probes (§5.4); for the top 10 cited domains, does the cited page list DocTalk? | Expected result: 0 of 10. This is the structural AEO finding: engines cite listicles and review sites, and DocTalk is on three small ones. Recorded as **proven by observation** (the citations are visible), with the fix outside code |
| A-5 | Brand collision inside AI answers | Brand probes | As A-2 |

## 5. AEO test protocol

### 5.1 Technical checks (E, 30 min, before any probe)

1. `curl -s https://www.doctalk.site/robots.txt` — confirm the generated file (`robots.ts` lists `GPTBot`, `ChatGPT-User`, `OAI-SearchBot`, `PerplexityBot`, `ClaudeBot`, `Google-Extended` explicitly; every other bot falls under `*`, which allows `/`). Record which of the 16 UAs in A-3 are named; none is disallowed, so this is a documentation line, not a finding. `CCBot` and `Bingbot` are covered by `*`.
2. UA matrix from S-1.1 — reuse the bodies.
3. `llms.txt` inventory diff (A-3). Also check it is linked from nowhere (expected) — not a defect; note that no engine is documented to use it for retrieval, so it is P3.
4. Schema validation (A-3) — 4 URLs on Rich Results Test; record eligible rich result types and errors. Parity is already guaranteed by tests; this is the production confirmation.
5. Server-rendered answer-first check: for `/`, `/compare/humata`, `/use-cases/students`, `/zh/use-cases/students`: the first 800 characters of `<main>` text (script-stripped) contain a self-contained statement of what DocTalk is and does. Record the excerpt.

### 5.2 Query list (fixed; do not improvise)

Category, English (run on all five engines):
- P-C1 best AI tool to chat with a PDF
- P-C2 AI PDF reader that cites the page number for every answer
- P-C3 which AI document assistant gives verbatim quotes with page references
- P-C4 ChatPDF alternatives
- P-C5 Humata alternatives
- P-C6 free AI to chat with PDF without signing up
- P-C7 AI with unlimited file uploads for PDFs
- P-C8 AI tool to summarize a research paper with citations

Brand (all five engines):
- P-B1 what is DocTalk
- P-B2 DocTalk AI document chat review
- P-B3 is doctalk.site safe to upload documents to
- P-B4 DocTalk vs ChatPDF

Comparison (ChatGPT, Perplexity, Google):
- P-X1 DocTalk vs Humata which is better
- P-X2 ChatPDF vs Humata vs AskYourPDF comparison

Chinese academic long tail (ChatGPT, Perplexity, Google with `hl=zh-TW&gl=TW` and `hl=zh-CN&gl=US`):
- P-Z1 读论文 ai 推荐
- P-Z2 论文ai 工具 免费
- P-Z3 文献阅读 ai 哪个好
- P-Z4 能标注原文页码的 pdf ai
- P-Z5 ChatPDF 替代品

Spanish (ChatGPT, Perplexity, Google `hl=es&gl=ES`):
- P-S1 ia para investigar gratis
- P-S2 mejor ia para leer pdf con citas
- P-S3 alternativas a chatpdf

Total: 12 × 5 + 2 × 3 + 8 × 3 = 90 probes, ≈ 1.5 min each ≈ 2.5 h. Compressed branch (§2 branching): P-C1..C8 on ChatGPT + Perplexity + Google only (24 probes).

### 5.3 Engines and access

| Engine | URL | Login | Notes |
|---|---|---|---|
| ChatGPT (search on) | chatgpt.com | none needed for basic use; if the session is logged in, keep it | Record whether "Search" was invoked (sources panel present). If no sources → mark `no_search` and rerun once with "search the web:" prefix |
| Perplexity | perplexity.ai | none | Record all numbered sources |
| Google AI Overviews / AI Mode | google.com with `&hl=en&gl=us&pws=0`; AI Mode via the "AI Mode" tab if shown | signed in (GSC account) | **Control query first**: `what is retrieval augmented generation` must show an AI Overview; if it does not render in the executor's region (CEST), mark AIO `unavailable` for the session and use Semrush's AI toolkit AIO rows for that engine instead. Record region |
| Copilot | copilot.microsoft.com | none | Bing-backed; record citations |
| Gemini | gemini.google.com | signed in (same Google account) | If blocked, drop Gemini and rely on Semrush's Gemini rows |
| Semrush AI toolkit [AI 可见性 / AI SEO 工具包] | find via left nav; record the path | owner session | Export the prompts/mentions/citations table; this is the primary measurement, probes are validation. Mark the 0 → 14 change as "first measured on 09-29" |

### 5.4 Recording schema (one CSV, `evidence/A-probes.csv`)

`date, engine, region_hl_gl, query_id, query_text, category, search_invoked(Y/N), doctalk_tier, doctalk_cited_url, doctalk_position_among_named_tools, tools_named(list), sources_cited(domains, list), third_party_source_naming_doctalk, screenshot_file, notes`

`doctalk_tier` (define before probing; the only thing that counts as "cited" is tier a):
- a — a `doctalk.site` URL is listed as a source/citation
- b — "DocTalk" named in the answer without a link to us
- c — DocTalk appears only inside a cited third-party page (not in the answer text)
- d — absent

Deliverables from the table: tier distribution per engine × category; cited-domain frequency for category queries (the earned-media gap list for A-4); the brand-entity outcome for P-B1..B4 (which DocTalk?).

## 6. Execution plan

### Phase 0 — Access and instrument inventory (E, 30 min, today)

1. Open each: GSC (known good), GA4, Bing Webmaster Tools, Vercel dashboard, GitHub, Gemini, ChatGPT session state. Record signed-in / not in `evidence/00-access.md`.
2. Semrush inventory: open Domain Overview, Organic Research → Positions and Position Changes, Backlink Analytics → Overview / Referring domains / Backlinks / Anchors / Indexed pages, Keyword Gap, Keyword Magic, Keyword Overview, Traffic Analytics, AI toolkit, Projects (look only — do not create). For each record: available / limited (row cap, export disabled, date picker missing) / locked (upgrade wall). This table goes in the report; the coordinator's open question about the reseller plan is answered here.
3. Create the evidence folder and the report skeleton with the section headings of §8.

**Locked-report fallback table (apply mechanically; log `LOCKED:<report>` and move on):**

| Semrush report | If locked or capped, use |
|---|---|
| Domain Overview | Organic Research → Positions (row count, traffic column) + GSC totals |
| Organic Research → Position Changes | Fresh Positions export diffed against `frontend/scripts/seo/data/organic_positions_us_20260919.csv` (same columns) |
| Organic Research per-country DBs | GSC Countries dimension + browser SERP checks (S-2.5) |
| Backlink Analytics → Referring domains / Backlinks / Anchors | GSC → Links (top linking sites, anchor text) — coarser but un-lockable; the delta since 09-19 then comes from `frontend/scripts/seo/data/backlink_hosts_20260920.psv` vs GSC's list |
| Backlink Audit (project) | Never used: Referring domains export + `build_disavow.py` classification |
| Site Audit (project) | Never used: squirrelscan `-C full` |
| Position Tracking (project) | Never used: GSC average position by query + browser SERP checks with `pws=0` |
| Keyword Gap | Existing `gap_full_us_20260919.psv`; no new gap pull is needed |
| Keyword Magic / Overview | GSC Queries export (990 rows) + Keyword Overview single lookups; if both locked, the five zh/es terms keep their 09-20 volumes/KD |
| Traffic Analytics | Skip. Panel-based; shows nothing for a domain with 1 organic visit |
| AI toolkit | Manual probes (§5) become the primary measurement |
| Exports disabled | Screenshot the table pages and transcribe the rows that matter (≤ 50 rows per report); note "transcribed" in provenance |

### Phase 1 — Gate 0 (E 3 h in parallel with O 10 min)

Parallel lanes:
- Lane 1 (E, GSC): G0-A export, G0-D query/page/country buckets, G0-E, G0-F, S-1.2 Pages + URL inspections, S-1.3 Sitemaps, S-3.1 CTR list. All in one GSC session, ~2 h.
- Lane 2 (E, GA4 if signed in): G0-C channel table by week, ~30 min.
- Lane 3 (E, Semrush): backlink delta (S-2.1), lost links (G0-C), Position Changes (S-2.3), ~1 h.
- Lane 4 (O): SQL-1..4 (§7), send outputs; answer the promotion-history question.

Gate 0 verdict written before Phase 2 starts (`report.md` §2). Apply the §2 branching.

### Phase 2 — Search branch (E, 2.5 h; compressed 1 h)

- Lane A: S-1.1 UA matrix, S-1.4 hosts, S-1.5 Bing, A-3 technical AEO (curl-heavy, 1 h).
- Lane B: S-2.5 locale markets, S-5.1/S-5.2 (browser + Semrush, 1 h).
- Lane C: S-2.7 squirrelscan + PSI (background, 30 min wall time).

### Phase 3 — AEO probes (E, 2.5 h; compressed 45 min)

Semrush AI toolkit export first, then §5.2 in order C → B → X → Z → S. Fill `A-probes.csv` as you go; screenshots named by `query_id-engine.png`.

### Phase 4 — Backlink hygiene (E, 30 min → O, 5 min)

Run `frontend/scripts/seo/build_disavow.py` logic against the fresh Referring-domains export (same psv shape as `backlink_hosts_20260920.psv`), producing `disavow-addendum-2026-09-30.txt` containing **only** domains not in the 09-20 file that match the two campaign anchors (or share the campaign's TLD/country pattern with AS 0–3 and a bare `doctalk.site` anchor first seen after 09-19). Owner uploads once (§7 item 3). Then **stop** re-disavowing unless GSC Manual Actions changes; Google's policy is devaluation, and the 09-20 report's standard stays: this is hygiene, not a ranking fix.

### Phase 5 — Synthesis (E, 2 h)

Write the report to §8's shape; every finding cites its evidence file; every hypothesis in §3–4 gets a status (PROVEN / CORRELATED / HYPOTHESIS / KILLED). Fable reviews before the owner reads it.

Steps that must wait for the owner: G0-B/G0-C SQL outputs and the promotion history (blocks the Gate-0 verdict — if not received within the day, write the verdict as "provisional on GA4 only" and proceed); Bing WMT login if not signed in (blocks S-1.5's full form; the `site:` form does not wait); the disavow addendum upload (does not block anything); the GSC Domain property (does not block; already on the 09-22 list).

Total executor time: ≈ 1.5 working days full branch, ≈ 0.75 day compressed.

## 7. Owner-only list（中文，按顺序，只做这些）

1. **跑三条只读 SQL（5 分钟）。** 用 09-22 清单里同一个命令模板（`railway variables --service Postgres --json` 取 `DATABASE_PUBLIC_URL`），用 `psql "$DATABASE_URL"` 依次执行下面 SQL-1 到 SQL-4，把输出原样贴给 Claude。如果 09-22 建的只读账号已经建好，直接把连接文件路径告诉 Claude，Claude 自己跑。
   - 先看一眼 provider 的真实取值（SQL-1 里的 `google` / `microsoft` / `magic_link` 判断按这个结果调整）：
     ```sql
     select provider, count(*) from accounts group by 1 order by 2 desc;
     ```
   - SQL-1（每周注册数 × 是否激活 × 登录方式 × 邮箱类型；排除 owner 账号）：
     ```sql
     with su as (
       select u.id, u.email, u.created_at,
              date_trunc('week', u.created_at)::date as wk,
              (select string_agg(distinct a.provider, ',') from accounts a where a.user_id = u.id) as providers,
              exists (select 1 from documents d where d.user_id = u.id) as uploaded,
              exists (select 1 from messages m join sessions s on s.id = m.session_id
                      where s.user_id = u.id and m.role = 'user') as messaged
       from users u
       where u.id::text not like 'c142f3af%' and u.created_at >= '2026-02-01'
     )
     select wk,
            count(*) as signups,
            count(*) filter (where uploaded or messaged) as activated,
            count(*) filter (where providers ilike '%google%') as google,
            count(*) filter (where providers ilike '%microsoft%' or providers ilike '%azure%' or providers ilike '%entra%') as microsoft,
            count(*) filter (where providers is null or providers ilike '%email%' or providers ilike '%nodemailer%' or providers ilike '%resend%') as magic_link,
            count(*) filter (where split_part(lower(email),'@',2) in ('gmail.com','googlemail.com')) as gmail,
            count(*) filter (where split_part(lower(email),'@',2) in ('qq.com','163.com','126.com','foxmail.com','sina.com')) as cn_mail,
            count(*) filter (where lower(email) ~ '\.edu(\.[a-z]{2})?$|\.ac\.[a-z]{2}$') as edu
     from su group by wk order by wk;
     ```
   - SQL-2（不受 cookie 同意影响的每周到达代理指标）：
     ```sql
     select date_trunc('week', created_at)::date as wk,
            count(*) filter (where event_name = 'landing_cta_clicked')   as cta,
            count(*) filter (where event_name = 'auth_modal_opened')     as auth_opened,
            count(*) filter (where event_name = 'auth_provider_clicked') as auth_clicked
     from product_events
     where (user_id is null or user_id::text not like 'c142f3af%') and created_at >= '2026-02-01'
     group by 1 order by 1;
     ```
   - SQL-3（匿名 demo 会话数/周）：
     ```sql
     select date_trunc('week', created_at)::date as wk, count(*) as demo_sessions
     from sessions where user_id is null and created_at >= '2026-02-01'
     group by 1 order by 1;
     ```
   - SQL-4（哪些营销页在产生 CTA 点击；若 `path` 全为空说明事件白名单没存它，照实告诉 Claude）：
     ```sql
     select date_trunc('month', created_at)::date as mo, metadata_json->>'path' as path, count(*) as n
     from product_events
     where event_name in ('landing_cta_clicked','auth_modal_opened') and created_at >= '2026-05-01'
       and (user_id is null or user_id::text not like 'c142f3af%')
     group by 1, 2 order by 1, 3 desc;
     ```
2. **GA4 导出（仅当 Claude 报告浏览器里打不开 analytics.google.com 时）。** 打开 GA4 → 报告 → 获客 → 流量获取；日期 2026-02-13 到 2026-09-28；主维度改成"会话来源/媒介"，加次要维度"周"；右上角导出 CSV，发给 Claude。
3. **Search Console：** 09-22 清单第 3 条（网域属性 + 重传 disavow + 基线导出）仍然有效；本次新增一步：Claude 会生成 `disavow-addendum-2026-09-30.txt`（只含 09-20 之后新出现的垃圾域名）。上传方法：disavow 工具里**下载当前文件，把新增行追加到末尾后再上传**（工具是整文件覆盖，不是追加）。做一次即可，之后除非"人工操作"报告出现新条目，不再重复。
4. **Bing Webmaster Tools（仅当浏览器未登录）：** 登录 `https://www.bing.com/webmasters`，看 `www.doctalk.site` 属性是否存在；"站点地图"里是否已提交 `https://www.doctalk.site/sitemap.xml`（没有就提交）；"搜索效果"导出最近 6 个月；截图"IndexNow"页面。把这四样发给 Claude。
5. **回忆题（两行字就够）：** 5–8 月你在哪里发过 DocTalk（Product Hunt、Reddit、V2EX、知乎、即刻、X、GitHub README、群聊、朋友）？最后一次是哪天？8 月的 17 个注册里有没有你认识的人？这是 GA4 看不到的那条渠道。
6. **IndexNow（仅当 Claude 报告 Bing 索引里没有 /zh、/es 等页面时）：** `curl -X POST https://www.doctalk.site/api/indexnow -H "Authorization: Bearer $AUTH_SECRET"`，把返回的 `status` 和 `submitted` 数字发给 Claude。一次就够。
7. **不要做的：** 不要买链接、不要自己去 disavow 别的域名、不要改 GA4 设置、不要在 Semrush 里新建项目（那个账号是共享的）。企业网关分类（09-22 清单第 2 条）与这次流量变化无关，它是常量，不是变化；做不做由你，本审计不再提。

## 8. The deliverable

**File:** `.collab/reviews/2026-09-30-seo-audit/report.md` (+ `evidence/`). Sections, in this order:

1. **Headline** (≤ 120 words): the Gate-0 verdict in plain words — real drop or not, channel named or not, Google organic never the channel, the one or two things worth doing.
2. **Gate 0**: the weekly table (signups all/activated, CTA, demo sessions, GSC clicks/impressions, GA4 sessions by channel) Feb → Sep with the deploy line overlaid as a column; the G0-B rate ratio and CI; the G0-C attribution with its three-of-three scoring; G0-D buckets; G0-E/F one-liners.
3. **Killed hypotheses**: each with the test that killed it (this section protects the next audit from redoing them).
4. **Findings, ranked**: each with ID, status label, evidence file, mechanism, impact (1–5), confidence (0.25 / 0.5 / 1.0), effort (S=1 / M=2 / L=4), score = impact × confidence ÷ effort, and who does it (code / owner / nobody).
5. **AEO scorecard**: tier distribution per engine × category; the cited-domain table; the brand-entity result; the Semrush toolkit numbers marked "first measured 09-29".
6. **Backlink status**: 09-19 vs 09-29 counts, campaign continuation evidence, addendum file, the standing rule (hygiene, not a fix).
7. **What to do next**: at most five items, each with the metric that reads it and the date it becomes readable. Anything requiring outreach or a marketing programme is listed once under "outside the owner's stated constraints" and not counted among the five.
8. **Owner-only actions**: §7 with status.
9. **Evidence index**: every export, screenshot, and the Semrush availability table from Phase 0.
10. **Open questions** and the instrumentation gap (referrer/UTM capture).

**Status labels — the rule that separates proof from correlation (same standard as the 09-20 report):**

- **PROVEN cause**: all three hold — (1) a mechanism is identified in code, config, a report string, or documented engine behaviour; (2) the timing matches the deploy/event line; (3) a discriminating test was run that would have failed if the hypothesis were false.
- **CORRELATED observation**: timing matches (2) but no mechanism or no discriminating test. Must be written as "coincides with", never "caused".
- **HYPOTHESIS**: untested; listed with the test that would decide it and its cost.
- **KILLED**: a test that would have confirmed it was run and came back negative; cite the test.

A finding may recommend action only if it is PROVEN, or CORRELATED with effort S and no downside. The AI-surface explanation for the impression decline can never exceed CORRELATED with today's GSC.

**Prioritisation floor:** anything whose maximum effect is < 10 clicks/week (all of S-3, S-2.7, the redirect chain, `lastmod`) is recorded in §4 but ranked below every AEO and indexing item regardless of its score, because the owner's metric is signups and Google clicks are 8/week.

## 9. What NOT to spend time on

| Excluded | Why (citation) |
|---|---|
| Re-deriving the keyword universe, intent map, or keyword→page mapping | `seo-deep-keywords.md` §1–14 (Feb); `findings.md` §2–6 (09-20: pages correctly targeted) |
| A new Keyword Gap pull or Keyword Magic sweep | The 1,053-row corpus is triaged in `keyword_triage.json`; the winnable set is known (`findings.md` §B, §D) |
| Legal/finance ICP research off competitor-gap data | Settled absent (`findings.md` §B); needs its own research, not this audit |
| JSON-LD parity, sitemap membership, per-locale meta keys | Build-time tests (`sitemap-routes.test.cjs`, `seo-meta-keys.test.cjs`, `marketing-jsonld.test.cjs`); one production spot-check only |
| Maximising the squirrelscan score, or any score (Semrush Site Health, PSI 100) | Vanity; only error-class crawl/index rules are findings (S-2.7) |
| Repeating the Feb technical audit (CSR home, hreflang, `lang`, middleware) | Superseded by 02-18, 04-13 (`ff56f5d1`), 05-24; `<html lang="en">` on locale pages is an accepted tradeoff in the 05-24 spec and only matters if S-1.2 shows duplicate-canonical reasons |
| Jev CJK calibration, Jev title selection | Gated on D2 and dropped in `2026-09-22-next-strategy.md` §3 |
| The 2-hop `http://doctalk.site` → `https://doctalk.site/` → www 308 chain | Minor; Google follows up to 10 hops; no click passes through it |
| `/document-diff` Disallow | Intended (authenticated tool; `document-diff/page.tsx:20-24`) |
| Brand-name disambiguation strategy | Settled: "doctalk ai" pos 2.1; head term demand for our entity ≈ 22 impr/month |
| Baidu, Naver, Yandex registration or ranking checks | zh demand for the five academic terms sits in Google's HK/TW/SG/US-zh databases; Baidu needs ICP; out of scope by the 05-24 spec |
| Link buying, outreach programmes, guest posting, directory campaigns | Owner "only writes code" (`2026-09-22-next-strategy.md` §3); one directory/profile list may be recorded in §7 of the report as outside constraints |
| More than one disavow addendum | Devaluation policy; hygiene only (`findings.md` §C; memory `seo-spam-backlinks-2026-09-20`) |
| Semrush Traffic Analytics | Panel data; no signal for a domain at this size |
| Creating Semrush Projects (Site Audit, Position Tracking, Backlink Audit) | Shared reseller account; use the fallback table |
| Reading Night (09-21) as a conversion cause | ≈ 10 CTA clicks/week; undecidable (`2026-09-22-next-strategy.md` §1); record only |
| CWV beyond one PSI run per template | Already measured 09-21 (`2026-09-21-v0.32-seo-impact.md`); not a ranking factor at AS 6 |
| Enterprise web-filter categorisation as a cause of the *change* | It is a constant since at least 08-25 (memory `topdown-review-2026-08-25`); it cannot explain a September drop |

### Critical Files for Implementation
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/.collab/reviews/2026-09-20-jev-seo/findings.md — the baseline every delta is measured against (09-19 Semrush numbers, winnable set, backlink campaign anchors)
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/scripts/seo/build_disavow.py — plus `frontend/scripts/seo/data/backlink_hosts_20260920.psv` and `organic_positions_us_20260919.csv`: the classification logic and the two 09-19/09-20 exports the Semrush deltas diff against
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/app/robots.ts — the AI-crawler allow list and the `/document-diff` Disallow the UA matrix (S-1.1, A-3) verifies in production
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/app/sitemap.ts — the 405-URL, hreflang-bearing sitemap that S-1.2/S-1.3 check against GSC's Pages and Sitemaps reports
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/components/AnalyticsWrapper.tsx — with `frontend/src/lib/analytics.ts`: the consent gate on GA4/Vercel Analytics and the un-gated `product_events` path that Gate 0's channel attribution depends on

---

# Amendment 1 to `2026-09-30-seo-audit-design.md` (GA4 evidence, 2026-09-30)

## What changes

- **Gate 0 is decided: real cliff, named channel.** chatgpt.com first-users 32 → 27 → 7 → 4 → 10 → 5 (Apr→Sep); Google 9 → 6 → 3 → 4 → 8 → 7. Control ratio (C-1 below): ChatGPT Aug–Sep ÷ Apr–May = 15/59 = 0.25; Google = 15/15 = 1.0. Seasonality explains the Jun–Jul dip in both; only ChatGPT failed to recover. Bing referrals 2, 3 → 0, 0, 0, 0 on the same boundary, and Direct/Unassigned (where ChatGPT-app clicks land without a referrer) fell in step. The §2 branch taken is "real drop + named channel, mechanism unknown"; the §3 Search tree runs **compressed** and a new sub-tree C runs first. G0-B (Poisson on activated signups) and G0-C's three-of-three scoring still run, but only to confirm, not to decide.
- **S-1.2 / S-1.3 are answered and become findings now**, not tests: F-1 sitemap last read 2026-05-24, 255 discovered vs 405 live (zh/it/ar/hi locales, `/trust`, layout-translation never reached Google via the sitemap); F-2 101 "Crawled – currently not indexed", ~86 real pages dominated by translated compare/alternatives/use-cases/features — a PROVEN constraint (Google's own reason string) that reorders the 09-22 §2.2 zh/es plan (index first, then deepen), but **not** a ChatGPT cause: ChatGPT's landing pages were `/` and `/blog/chatpdf-alternatives-2026`, both EN. F-3 `/blog/best-ai-pdf-tools-2026` = 42 % of all impressions at pos 8.3, 11 clicks — the G0-D "zero-click visibility" page, record only. S-3 is dropped; S-2.7 is done (no crawl/index errors); S-1.1's UA matrix stays because it is C-4's current-state test; S-2.5 shrinks to the Worldwide-tab screenshot plus two SERP checks.
- **squirrelscan "thin /ja 79 words, /zh 130 words"** is not accepted as-is: CJK has no word spaces. Test: `curl -A Googlebot https://www.doctalk.site/ja` → strip scripts/tags → count characters and grep one FAQ answer. ≥ 1,500 characters with the FAQ present → tokenizer artifact, killed; else a PROVEN SSR gap in `app/[locale]/page.tsx` (scoped `LANDING_PREFIXES`) and a Priority-1 code item.

## New sub-tree C — why did ChatGPT stop sending users (May → June 2026)?

| ID | Hypothesis | Test (runner) | Pre-registered rule |
|---|---|---|---|
| C-1 | Seasonality / normal variance | Already computed from GA4 (E) | ChatGPT ratio < 0.5 while Google ≥ 0.8 → ChatGPT-specific loss. **Met: 0.25 vs 1.0.** |
| C-2 | Consent-rate artifact (banner changed 05-23) | GA4 monthly users ÷ un-gated proxy (SQL-2 CTA + SQL-3 demo sessions) per month (O SQL, E ratio) | Ratio drop ≥ 50 % in June shifts every channel equally; the ChatGPT-vs-Google contrast survives regardless → cannot explain the cliff. Report the coverage number either way. |
| C-3 | Retrieval loss at Bing (ChatGPT search's index; Bing referrals → 0 corroborate) | Bing WMT (O login if not signed in): Search performance by month Apr–Sep, Sitemaps status, URL inspection of `/blog/chatpdf-alternatives-2026` and `/` (Bing-selected canonical), notifications. Fallback (E): `bing.com/search?q=site:doctalk.site&cc=US&setlang=en` count; Bing rank for `chatpdf alternatives`, `chatpdf alternatives 2026`, `best ai pdf tools 2026`, `doctalk ai` | Bing impressions Jun–Sep < 25 % of Apr–May, or the two landing pages absent from Bing → **PROVEN retrieval loss at Bing** (mechanism + timing + discriminating test). Then C-6/C-7 decide *why*; if neither holds → "Bing-side quality/spam action, cause unproven", fix = resubmit sitemap in BWT + one IndexNow POST + wait 28 d. |
| C-4 | OAI-SearchBot / ChatGPT-User blocked or challenged | Current: S-1.1 UA matrix (E). Historical: owner opens Vercel → project → Firewall: Bot Protection / Attack Challenge Mode status and change history; Traffic view filtered by user-agent `OAI-SearchBot`, `ChatGPT-User`, `bingbot` (30-day window only) | Any challenge/403 for those UAs now or in logs → PROVEN. All 200 and no rule ever enabled → killed for the present; historical state beyond 30 d stays HYPOTHESIS and is said so. |
| C-5 | ChatGPT's answer composition changed (cited listicles or model knowledge no longer name DocTalk) | Probes P-C4, P-C8 and the queries behind each historic ChatGPT landing page (from the session-source × landing-page pull) on ChatGPT with search on, tiered per §5.4; Semrush AI-toolkit prompts where DocTalk is mentioned today (E) | Tier d on ≥ 80 % of these probes with cited sources being listicles that omit DocTalk → CORRELATED at most (May answers are unrecoverable); the recovery path is A-4 (be on the cited sources) plus C-3's fix. Owner asked once whether any May screenshots of ChatGPT recommending DocTalk exist. |
| C-6 | The 05-23 editorial rewrite changed the two landing pages' title/H1/body | `git log -p --since=2026-05-15 --until=2026-06-10 -- frontend/content/blog/chatpdf-alternatives-2026.md frontend/src/app/blog frontend/src/app/page.tsx frontend/src/app/layout.tsx frontend/src/app/robots.ts frontend/src/app/sitemap.ts frontend/next.config.mjs` (E); word count and `<title>`/`<h1>` before vs after | Blog markdown untouched (frontmatter `updated` = 03-18 says so) and only the shell changed → killed for the post; `/` title/H1 changed on 05-24 → CORRELATED only if C-3 shows Bing dropped `/` specifically. |
| C-7 | The 05-24 hreflang cluster made Bing swap or drop the EN canonical | Bing `site:doctalk.site/blog/chatpdf-alternatives-2026` and `site:doctalk.site chatpdf alternatives`: which URL Bing returns; BWT URL inspection canonical (E) | Bing returns a locale URL or nothing where EN should appear → CORRELATED with the 05-24 timing (mechanism plausible, not observable); fix = resubmit + IndexNow, then re-test at +28 d. |
| C-8 | OpenAI-side product/index change (residual) | None available | Held only if C-3..C-7 all come back negative; stated as "not actionable; same recovery path as A-4". |

## Revised execution order

1. **Phase 0 (E, 30 min)**: unchanged, plus Bing WMT sign-in check first — it is the linchpin of C-3.
2. **Phase 1 (E 1 h ∥ O 10 min)**: G0-B/G0-C confirmation from SQL-1..4; C-2 coverage ratio; finish the GA4 session-source × landing-page pull for chatgpt.com (Apr–Sep) — it defines C-5's query list.
3. **Phase 2 = sub-tree C (E, 2.5 h)**: C-3 (Bing) → C-6 (git diff) → C-4 current state (UA matrix) → C-7 → C-5 probes (these replace the first 10 AEO probes; the remaining §5.2 list runs after, compressed to ChatGPT + Perplexity + Google).
4. **Phase 3 (E, 1 h)**: compressed Search tree — /ja character-count test, S-2.5 short form, S-1.4 hosts, A-3 llms.txt diff, S-5.2 profiles.
5. **Phase 4 (E 30 min → O 5 min)**: disavow addendum, unchanged.
6. **Phase 5 (E, 2 h)**: report; the headline is now "arrivals fell ≈ 75 % between May and June 2026 because ChatGPT referrals stopped; Google organic never moved; cause = [C-3..C-8 status]".

Owner list additions (in order of blocking): (1) Bing WMT 登录（若浏览器未登录）— 阻塞 C-3；(2) Vercel → 项目 → Firewall：截图 Bot Protection / Attack Challenge Mode 的状态和变更记录，Traffic 里按 UA 过滤 `OAI-SearchBot`、`ChatGPT-User`、`bingbot` 看是否有 challenge/403 — C-4；(3) 批准 Claude 在 GSC 点一次 "重新提交" sitemap，并对 `/zh/use-cases/students`、`/es/use-cases/students` 各点一次"请求编入索引"（F-1/F-2 的修复验证，48 小时后复查 Last read 是否更新到 405）；(4) 有没有 5 月 ChatGPT 推荐 DocTalk 的截图或对话链接（C-5）。The 09-22 GSC Domain-property item and the IndexNow POST stay as written; IndexNow now also serves C-3/C-7 and should fire regardless of the Bing `site:` result.

Proof standard, branching, deliverable shape, exclusions and critical files are unchanged.
