# Un-gated channel readout and probe day 1 (2026-10-14)

Traffic plan v2 Step 3 (the 10-13 read, run one day late) and Step 6 (Perplexity day 1). Plan:
`.collab/plans/2026-10-10-traffic-plan-v2.md` §2 (synthesis rule) and §3.

## Result

1. **Volume is very small.** 23 attributed-event rows in 13.6 days since Release A (09-30 21:59:43Z), owner excluded.
   5 signups since 10-05, 3 of them activated.
2. **ChatGPT is the only AI source measured, and the largest channel by count: 7 of 9 attributed events.** It meets
   the volume and share bar in one week only (10-05: 7 attributed, 86 % AI). No independent source was read.
   Label: **HYPOTHESIS**.
3. **C-9 (Release B listicle refresh) has no signal yet.** ChatGPT-referred events on the three listicles: 0 in the
   baseline window (9.4 d), 0 after Release B (4.2 d). Every one of the 23 events landed on `/`, `/de` or `/auth`.
   The pre-registered event bar ("≥ 3× the baseline weekly rate") is met by 0 when the baseline is 0, so it cannot
   decide the read. Question Q2 for Fable.
4. **New source: the GSC "Generative AI features" report.** It counts 7.51K impressions in Google AI features from
   06-01 to 10-13. About 74 % of them (5,546) are on `/blog/best-ai-pdf-tools-2026`, a post frozen until the 11-07
   read with queued factual fixes. Question Q1 for Fable.
5. **Perplexity day 1: 2 of 7 probes are tier a, both brand/comparison queries.** Both answers were built from our
   `/compare/*` pages. All 5 category and locale probes are tier d. Perplexity read copies of our pages that were 1
   to 4 days old.
6. **Copilot is still blocked** ("Verification required" after the query was submitted).

## 1. Sources and method

- Database: `readout_1014.py` (this directory), run 2026-10-14 12:46:53Z on production Postgres, read-only session
  (`default_transaction_read_only = on`, SELECT only). Output: `readout-1014.txt`. The owner's signed-in events are
  excluded. Weeks are ISO weeks starting Monday, UTC.
- Partial periods:
  - DB week 09-28 starts at Release A (09-30 21:59Z), so it covers 4.1 days.
  - DB week 10-12 ends at the run time, so it covers 2.5 days.
  - GSC data for 10-12 and 10-13 is not final (GSC fills in 2 to 3 days late). Do not read a decline from them.
- GSC: Performance → Search results, 2026-09-28 → 10-13, daily table; Performance → Generative AI features (beta),
  06-01 → 10-13 and 09-28 → 10-13, daily and page tables. Read in the browser on 10-14, about 12:48–12:50Z.
- Attribution capture still works. `lib/attribution.ts`, `components/AnalyticsWrapper.tsx`, `lib/analytics.ts`
  and `backend/app/api/events.py` have no commit in `e91cace9..origin/stable` (Release A → today). On 10-14, 2 of
  the 20 JavaScript chunks of the live home page contain `ref_host`.
- Per-event timestamps and the signup-to-journey matching are kept outside the repository (the repository is public).
  This report gives aggregates only.

## 2. Channel table (plan v2 §2)

Un-gated events (`landing_cta_clicked` + `auth_modal_opened` + `auth_provider_clicked`) by channel, with the
engine-side and outcome columns beside them. The columns are shown side by side, not reconciled.

| ISO week | AI | Google | Bing | Referral | Unattributed | Attributed | AI share of attributed | GSC clicks | GSC impressions | GSC AI-feature impressions | Signups (activated) | Anonymous demo sessions (with a question) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 09-21 | – | – | – | – | – | – | – | – | – | 438 | 8 (5) | 7 (7) |
| 09-28 ¹ | 1 | 1 | 0 | 0 | 2 | 2 | 50 % | 5 | 901 | 427 | 0 (0) | 4 (4) |
| 10-05 | 6 | 1 | 0 | 0 | 2 | 7 | 86 % | 8 | 887 | 487 | 2 (1) | 9 (8) |
| 10-12 ² | 0 | 0 | 0 | 0 | 10 | 0 | – | 2 | 118 | 52 | 3 (2) | 3 (1) |

¹ DB events from 09-30 21:59Z; GSC columns are the full week 09-28 → 10-04.
² DB to 10-14 12:46Z; GSC 10-12 → 10-13, not final.

GSC weekly values are sums of the daily rows (Search results: 15 clicks and 1.91K impressions for 09-28 → 10-13,
matching the report header). Signups: `users.created_at`; activated = at least one document or one user message.
Week 09-21 has no un-gated events because attribution went live on 09-30.

### Per event: the 10-27 rule

| ISO week | `auth_provider_clicked` AI | Unattributed |
|---|---|---|
| 09-28 | 0 | 0 |
| 10-05 | 2 | 1 |
| 10-12 | 0 | 3 |

The 10-27 rule is "AI ≥ 30 % of attributed `auth_provider_clicked`". Today it would read 2 of 2 = 100 %, on n = 2.
The rule sets no minimum count. Question Q3 for Fable.

### Sources and landing paths (whole window)

| Count | Channel | `ref_host` | `utm_source` |
|---|---|---|---|
| 14 | unattributed | – | – |
| 5 | AI | – | chatgpt.com |
| 2 | AI | chatgpt.com | chatgpt.com |
| 2 | Google | www.google.com | – |

- Landing paths: `/` 21, `/auth` 1, `/de` 1. No blog, compare or alternatives path.
- 5 of the 7 ChatGPT events carry ChatGPT's own `utm_source=chatgpt.com` tag with no referrer. ChatGPT therefore links
  to the home URL directly, not to a listicle.

### Why every landing path is a home page

This is partly how the events are emitted, not only where visitors land:

- A blog landing is recorded. `safeLandingPath` keeps `/blog/<slug>`. The blog's links, its CTAs (`/demo`) and the
  header's sign-in link (`/auth`) are `next/link` client navigations, so the first-touch values in module memory
  survive.
- But a blog page emits no attributed event of its own. `landing_cta_clicked` fires only on the home hero, the home
  final CTA and `PublicHeader`. A visitor who lands on a listicle is counted only when they open the sign-in modal or
  click a provider button.
- So the C-9 zero is a real zero, but it measures a later funnel step than the home-page count does.

### Week 10-12: all 10 events unattributed

The 10 events are 4 journeys: 1 on 10-12, 1 on 10-13 (`/de`, followed by a magic-link signup that uploaded), and 2 on
10-14 (each followed by a signup; one uploaded and asked a question). Attribution capture did not change (§1), so
these are visits with no referrer and no utm tag: typed or bookmarked URLs, apps that strip the referrer, or a full
page reload that reset the first-touch values. The last cause makes "unattributed" an overcount.

### Signups since 10-05

Pre-sign-in events carry no `user_id`, so signups cannot be joined to events. Matched by time only:

- 2 of 5 signups (10-06 and 10-08) come right after an AI-attributed `auth_provider_clicked` on the same day. The
  10-08 user uploaded a document.
- 3 of 5 (10-13, 10-14, 10-14) come right after unattributed journeys. Two of them activated.
- These are not the owner: the owner id is excluded, and the four test documents (`41bb6407`, `0089131c`,
  `1c31f603`, `f957e778`) belong to the owner account.

## 3. Labels (plan v2 §2 rule)

| Claim | Label | Why |
|---|---|---|
| AI assistants (ChatGPT) are the channel | HYPOTHESIS | (i) met in 1 week (10-05), not in 2 consecutive weeks: 09-28 has 2 attributed events, 10-12 has 0 (partial). (ii) no independent source read: GA4 not read, Brand Radar needs the owner's Ahrefs login, ChatGPT probes need the owner's MFA. Largest channel by count. |
| Google search is a channel | HYPOTHESIS | 2 site events in 13.6 days (below the volume bar). GSC clicks (5, 8 per week) agree in direction. |
| Bing, referral | no reading | 0 events. |
| C-9: Release B made ChatGPT send listicle visitors | no signal yet (read 11-07) | Event arm: 0 → 0, and its bar is undefined at a zero baseline (Q2). Probe arm: post-B reads so far are P-C1 d and P-C8 d. P-C4 and P-C6 have only 09-30 reads (both d) and must be re-run before 11-07. |
| 10-27 rule (AI ≥ 30 % of attributed provider clicks) | not yet readable | n = 2 (Q3). |

## 4. GSC Generative AI features report (new)

The beta report counts impressions of doctalk.site links in Google's AI features. Its tables show impressions only.

| Period | Impressions |
|---|---|
| 06-01 → 10-13, report header | 7.51K |
| 06-01 → 10-13, sum of the daily table (134 rows) | 7,437 |
| June | 227 |
| July | 545 |
| August | 4,178 |
| September | 1,728 |
| October 1–13 | 759 |
| Daily, 10-04 → 10-11 | 60–86 |

Top pages, 06-01 → 10-13:

| Page | Impressions |
|---|---|
| `/blog/best-ai-pdf-tools-2026` | 5,546 |
| `/features/citations` | 407 |
| `/` | 377 |
| `/blog/chatpdf-alternatives-2026` | 370 |
| `/alternatives/askyourpdf` | 183 |
| `/blog/free-ai-pdf-chat-no-signup` | 119 |
| `/alternatives/chatpdf` | 87 |
| `/alternatives/humata` | 75 |
| `/blog/best-ai-tools-academic-research-2026` | 73 |
| `/blog/notebooklm-alternatives-2026` | 61 |

- `/blog/best-ai-pdf-tools-2026` has about 74 % of the total (5,546 of 7.51K). For 09-28 → 10-13 it has 824 of the
  966 impressions in the daily table (85 %).
- The pages read do not say whether these impressions are also counted in the Search results totals, so the two
  reports are not added or compared as shares.
- The post is frozen until the 11-07 C-9 read. `vendor-evidence.md` §3 lists what current vendor pages contradict in
  it: AskYourPDF Word and URL support marked "—", PowerPoint "Yes" for AskYourPDF PDF chat, ChatDOC page-number
  citations not credited, Gemini Notebook jump-to-quote not credited (queue entry in `actions-log.md`, 10-10).
- The August peak (4,178, 56 % of the daily-table sum) has no known cause.

## 5. Perplexity day 1 (logged out, 2026-10-14 14:50–14:55 CEST)

Rows are in `../2026-09-30-seo-audit/evidence/A-probes.csv`. Tiers: a = doctalk.site URL cited; b = named without a
link; c = only inside a cited third-party page; d = absent.

| Probe | Query | Tier | Sources | Note |
|---|---|---|---|---|
| P-C1 | best AI tool to chat with a PDF | d | autogpt.net, adobe, denser.ai | NotebookLM first |
| P-C7 | AI with unlimited file uploads for PDFs | d | otio.ai | names only Otio |
| P-C8 | AI tool to summarize a research paper with citations | d | otio.ai, paperpal.com, linnk.ai, guides.lib.purdue.edu | first valid read (09-30 hit the logged-out limit) |
| P-B4 | DocTalk vs ChatPDF | **a** | doctalk.site/compare/chatpdf, therundown.ai | built from our compare page |
| P-X1 | DocTalk vs Humata which is better | **a** | doctalk.site/compare/humata, toolmango.com | built from our compare page |
| P-Z2 | 论文ai 工具 免费 | d | cnblogs, cloud.tencent, blog.csdn | Chinese blogs |
| P-S1 | ia para investigar gratis | d | bibliotecas.duoc.cl, cloud.google, datacamp.com, techpickai.com, gamma.com.ai | general research assistants |

- With the 09-30 reads: brand and comparison probes are tier a (P-B1, P-B4, P-X1). Every category and locale probe is
  tier d (P-C1..C8, P-Z1, P-Z2, P-S1). A visitor who does not already know the name does not meet DocTalk on
  Perplexity.
- **Perplexity reads old copies.** P-B4 repeats "highlights the cited passage in PDFs and TXT files", the copy that
  was live from 10-11 to the 10-13 widening (the live page now says "in your document"). P-X1 quotes Humata Student
  $4.99 and Expert $14.99 "in DocTalk's comparison"; those values left `/compare/humata` in `3def39df` (live
  10-10 13:38Z). Copies are therefore 1 to 4+ days old. Probes on 10-28 can still reflect pages from before a
  release; 11-07 is far enough from the 10-10 releases.
- No logged-out limit message after 7 probes.
- Copilot (plan §4 retry, fresh tab): the page loaded with no challenge in the owner's signed-in personal Microsoft
  account, but the submitted query P-C4 returned "Verification required". Marked blocked; not retried. The query
  stays in that account's Copilot history.
- Left for 10-28: P-B2, P-B3, P-X2, P-Z3, P-Z4, P-Z5, P-S2, P-S3. Before 11-07: P-C4 and P-C6 again (C-9 probe arm).

## 6. Questions for Fable

- **Q1. Unfreeze `/blog/best-ai-pdf-tools-2026` now, or hold until 11-07?** It carries about 74 % of Google
  AI-feature impressions (60–86 a day) and has known errors about competitors. The freeze protects C-9, which
  measures ChatGPT and probe citations, a different surface from Google AI features. Releasing the queued fixes now
  would be a second intervention on that URL before the read and must be logged as one. Claude's lean: release only
  the `vendor-evidence.md` §3 factual corrections, no structural or ranking change, and log the timestamp.
- **Q2. Restate the C-9 event bar for a zero baseline.** Options: (a) ≥ 1 qualifying event after Release B, by the
  precedent of plan §1 row 2 ("0 → baseline 0 and the success bar is ≥ 1 cited URL"); (b) drop the event arm and read
  the probe arm only. Note the measurement gap in §2: a listicle visitor is counted only at the sign-in step.
- **Q3. Give the 10-27 rule a minimum count.** It reads 2 of 2 today.

## 7. Next

- Readouts 10-20, 10-27, 11-03: rerun `readout_1014.py` (it has no date bound other than Release A).
- Probes 10-28 (list in §5) and 11-07 (P-C1, C4, C6, C8 for C-9).
- Owner-only, unchanged: Ahrefs login (Brand Radar), ChatGPT MFA, GSC domain property, disavow addendum.
