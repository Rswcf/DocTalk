# SEO findings — Semrush + Jev, 2026-09-20

Data: Semrush US database, crawl date 2026-09-19. Triage: Jev (`jev-1.13.0`),
101 gap keywords, 5 judgments each, one request per keyword, $0.0051 total.
Raw: `frontend/scripts/seo/out/keyword_triage.json`, `data/*.csv`.

**Sampling limit, stated up front:** the untapped gap is 1.1K keywords over 11
virtualized pages. This pass captured page 1 (the 63 highest-volume rows) and
page 11 (the 38 lowest-volume rows), i.e. both ends of the volume range but not
the middle. Conclusions about *which clusters exist* are safe; a claim that a
cluster is *absent* is only as good as the sample.

## 1. Where the site actually stands

| Metric | Value |
|---|---|
| Organic traffic (US) | **1 visit** |
| Organic keywords | 37 rows / 31 distinct (US 37, IN 5, CA 2) |
| Keywords in top 10 | **1** |
| Authority Score | 6 |
| Referring domains / backlinks | 191 / 306 |
| AI visibility (ChatGPT, AI Overviews, AI Mode, Gemini) | **0 mentions, 0 cited pages** |

The single top-10 keyword is `demo document` (#6, vol 40) on `/features/free-demo`,
and it is the source of 100% of the site's organic traffic.

**The 306-backlink / 191-referring-domain figure looked anomalous** for a site with
one organic visit and AS 6. The addendum below resolves it: 96% of those domains sit
at Authority Score 0–10 and 43% carry link-selling spam anchors. It is not an
unexplained signal — it is spam, and it is still arriving.

## 2. What we rank for, and the shape of it

Of 37 ranking rows, **14 point at one blog post**, `/blog/ai-research-paper-summarizer`,
all at positions 62–93. That post is the site's only real topical cluster and it
addresses the academic ICP — but page 7–10 is invisible.

Two genuine cannibalizations (the other repeated rows are one URL under two SERP
features, not two competing URLs):

- `doctalk` (vol **320**, our largest keyword by volume): `/` at #19 **and**
  `/contact` at #40.
- `docalysis` (competitor brand): `/blog` at #61 and `/` at #72.

**`/contact` is absorbing brand search.** It ranks #20 for `doctalk login`, #27 for
`doctalk texasips`, #40 for `doctalk` — while the home page manages only #19 for the
product's own name. Nothing on the site ranks in the top 10 for its own brand.

Zero rankings for any category term: `chat with pdf`, `ai pdf reader`, `pdf ai`,
`pdf summarizer` — none.

## 3. The competitor gap, after Jev filtered it

Overlap: doctalk.site **31** · chatpdf.com **1K** · humata.ai **51**. Shared
keywords with both: **0**. Untapped: 1.1K.

askyourpdf.com was dropped from the comparison after its 5.3K keywords turned out
to be a writing-tool farm (`ai humanizer`, `paraphrasing tool`, `discord fonts`,
`glitch text generator`, `instagram name generator`, `lyrics generator`) — a
different business, and it drowns the category signal.

Jev's relevance filter on the 101 sampled keywords: **53 relevant (p≥0.60), 36
rejected (p<0.30), 12 in a grey band**. Spot-checking the rejections confirms them:
`flashcard maker` (22.2K), `chat detector` (9.9K), `slaughtered vomit dolls` (9.9K),
`shippuden filler`, `ai powerpoint presentation`, and AI-detector queries in six
languages. A substring filter on "pdf" would have admitted `pdf ai detector` and
`ai checker pdf` while dropping `and ask questions`, `help pdf` and
`study guide generator free pdf`.

### Clusters that matter

| Cluster | Keywords | Monthly volume | Competitor position |
|---|---|---|---|
| **Competitor brand names** | 6 | **17,290** | we own pages for all of them |
| Category head (`chat pdf`, `pdf ai`, `ai pdf reader`) | 18 | 19,270 | chatpdf #1–#3 on nearly all |
| Summarization (`pdf summarizer`, `summarize pdf`, `pdf summarization`) | 28 | 19,740 | chatpdf #2–#5 |

**The competitor-brand cluster is the highest-leverage finding.** We already have
`/compare/{chatpdf,humata,askyourpdf,notebooklm,pdf-ai}` and the five matching
`/alternatives/*` pages, and their titles and keywords are correctly targeted
(`DocTalk vs ChatPDF: Full Comparison (2026)`, `7 Best ChatPDF Alternatives in
2026`). They rank for nothing except `chatpdf alternative` at #32/#57 (vol 70).

Within that cluster, `humata` (1.3K, KD 38) and `humata ai` (1K, KD 53) are the
open field: **chatpdf.com does not rank for either**, and we have two pages aimed
at them.

### The winnable set (Jev-relevant AND KD <= 40), from the sample only

A Semrush KD<=35 filter was attempted and did **not** apply (the summary still read
1.1K and the returned rows carried KD 49-93). This table is therefore the winnable
subset of the 101 sampled rows, not of the 1.1K corpus. Read it as examples, not as
an exhaustive list.

| Volume | KD | chatpdf | Keyword | Should own |
|---|---|---|---|---|
| 1,600 | **9** | #3 | `chatty pdf` | (no page — see §5) |
| 1,300 | 38 | — | `humata` | `/compare/humata` |
| 1,000 | 21 | #19 | `help pdf` | features |
| 30 | 21 | #12 | `best ai to summarize pdf` | features |
| 30 | 22 | #44 | `ai extract data from pdf` | features |
| 30 | 28 | #31 | `pdf file analyzer` | features |
| 30 | 39 | #5 | `ai notes from pdf` | features |

## 4. Two hypotheses from the sample — NOT established findings

Both statements below are absence claims, and the sample is the head and the tail of
the volume range with pages 2-10 (~900 rows, the 40-480 band) unread. Absence is
exactly what this sample is weakest at. Treat these as hypotheses to test by pulling
the middle pages, not as conclusions to act on.

**4.1 Hypothesis: heavy-document demand is thin.** Both purchase intents DocTalk has ever
recorded were upload-limit events (2026-05-06 `file_size`, 2026-09-16 `upload_error`).
Across the sampled gap, exactly **one** keyword carries heavy-document intent:
`large pdf summarizer`, 30/mo, KD 51. If the middle of the corpus is similar, the only
validated purchase trigger has little search demand behind it and cannot be scaled
through SEO. One keyword in a biased sample does not establish that.

**4.2 Hypothesis: the ICP is not in the competitor gap.** Jev's ICP split over the 53 relevant
keywords: **general 45, academic 8, legal 0, finance 0.** DocTalk's ICP per prior
research is lawyers, analysts and researchers. ChatPDF's keyword footprint simply
does not contain legal or finance demand, If that holds across the full corpus, the
§9.0 "ICP-targeted acquisition" branch cannot be driven off this competitor gap and
needs its own keyword research against legal/finance-tech vocabulary. Legal and
finance queries are typically lower-volume long tail, which is precisely the band
this sample skipped — so this hypothesis is the more likely of the two to fall.

## 5. Where Jev's answer was wrong, and why

`chatty pdf` (1.6K, **KD 9** — the lowest-difficulty relevant keyword found) was
routed to `home` at confidence 0.55. That is wrong: it is a competitor brand
(chattypdf.com) and belongs on a `/compare` or `/alternatives` page. It was routed
to `home` because **no such page exists**, and the docs are explicit that the model
cannot choose an option that was omitted from the criteria. The fault is in the
option set, not the model. Recorded rather than acted on: creating that page is a
new marketing page, which is a non-goal until 09-28.

13 of 53 routings came back below 0.5 confidence, all of them genuine home-vs-features
splits on queries like `pdf summarizer ai` (home 0.49 / features 0.46) — the
ambiguity is real, because the home page and the feature pages make overlapping
promises.

## 6. The honest diagnosis

The pages are well built and correctly targeted. `/compare/chatpdf` targets
`chatpdf alternative`; `/alternatives/humata` targets `humata alternatives`. Nothing
in the keyword-to-page mapping is obviously wrong.

What is missing is **authority and any ranking foothold**: Authority Score 6, one
keyword in the top 10, and a brand term the home page cannot win. Re-titling pages
that sit at position 62–93 moves nothing; position 62 and position 93 are both zero.

That reframes the priority order:

1. **Win the brand term.** `doctalk` is 320/mo, our largest keyword, and the home
   page sits at #19 for the product's own name. **Verified 2026-09-20: `/contact` is
   not misconfigured** — its title is `Contact DocTalk Support`, its description
   leads with "Contact the DocTalk team", and its keywords are `contact doctalk` /
   `doctalk support`. It ranks for brand queries because it is correctly targeted at
   brand-plus-support intent. Retitling it would break a correct page and is not the
   fix. The problem is that the home page is weak, which is an authority problem, not
   a metadata one. One thing worth noting separately: `doctalk login` (#20) lands on
   `/contact`, which is a product-routing observation, not an SEO one.
2. **Consolidate the academic cluster.** 14 keywords already rank on one post at
   62–93. Internal links and depth on that one cluster is cheaper than starting new
   ones, and it matches the one ICP segment the gap data does contain (academic, 8).
3. **Point real internal links at the competitor pages.** They are correctly
   targeted and get no link equity; `humata` (KD 38, chatpdf absent) is the single
   most winnable brand term.
4. **Audit the 191 referring domains** before assuming authority is just young.
5. **Do not** chase the category head (`chat pdf` KD 69, `pdf` KD 100) at AS 6.
6. **Do not** build the ICP acquisition branch off this gap data — run separate
   legal/finance keyword research first.

## 7. What is executable inside the §9.0 #3 fence

Frontend-only, no new pages, no version bump:

- ~~Brand-term consolidation via `/contact` metadata~~ — **withdrawn after checking the
  file.** `/contact` is correctly targeted at `contact doctalk` / `doctalk support`;
  there is no metadata defect to fix, and changing it would damage a working page.
- Internal links from the academic blog cluster to `/use-cases/students` and to the
  competitor pages.
- Title/description work is still gated on the D2 GSC export; Semrush gives position,
  not impressions, and the acceptance rule is "zero impressions in the 28-day GSC
  baseline". Positions of 62–93 make zero impressions near-certain, but near-certain
  is not the pre-registered gate.

Out of the fence, recorded for 09-28: a ChattyPDF page (`chatty pdf`, KD 9), a
`large pdf summarizer` angle, legal/finance keyword research, and the link audit.

---

# Addendum, 2026-09-20 — full corpus + backlink audit

The two hypotheses in §4 were flagged as untested because the first pass sampled
only the head and tail. The full untapped corpus has now been pulled (1,053 rows
across all 11 pages) and triaged. **Coverage note:** 474 rows were carried to disk
and triaged after collapsing near-identical spelling variants of the same query —
about 30 misspellings of "ai detector", a dozen of "slaughtered vomit dolls", and
several dozen of "chatpdf" (`chatpdg`, `chatpfd`, `chta pdf`, `charpdf`…). Those
are duplicate observations of one intent, not distinct opportunities.

Jev over 474 keywords: **268 relevant (p≥0.60), 157 rejected, 49 grey.**
474 requests, 45 seconds at 8-way concurrency, **$0.024**.

## A. Hypothesis 4.1 — heavy-document demand: CONFIRMED

Across all 474, only **3** keywords carry heavy-document intent, **380/mo combined**:

| Volume | KD | chatpdf | Keyword |
|---|---|---|---|
| 260 | **21** | **not ranking** | `ai with unlimited file uploads` |
| 90 | 34 | **not ranking** | `ai with unlimited uploads` |
| 30 | 51 | #8 | `large pdf summarizer` |

The only validated purchase trigger DocTalk has (both intents ever recorded were
upload-limit events) is **not scalable through search**. 380/mo is not a channel.

But the top row is a genuine, winnable, on-thesis opportunity: KD 21, and ChatPDF
does not rank for it at all. It is one keyword, not a strategy.

## B. Hypothesis 4.2 — ICP: CONFIRMED for legal/finance, WRONG about academic

Over the 268 relevant keywords: **general 227 (79,190/mo), academic 41 (9,030/mo),
legal 0, finance 0.**

Legal and finance are genuinely absent — the first pass was right, and pulling the
middle band did not rescue them. ChatPDF's footprint contains no contract, filing
or compliance demand. **The §9.0 ICP-targeted acquisition branch cannot be built
from competitor-gap data; it needs its own research.**

The academic side, however, is much larger than the sample suggested, and it
contains the lowest-difficulty keywords found anywhere in this study — in Chinese:

| Volume | KD | chatpdf | Keyword |
|---|---|---|---|
| 480 | 32 | #13 | `学术ai` |
| 210 | **8** | #9 | `论文ai` |
| 210 | **17** | #3 | `读论文 ai` |
| 170 | **20** | #17 | `文献阅读` |
| 720 | 20 | #12 | `ia para investigar gratis` (Spanish) |

**DocTalk already serves `/zh/...` and `/es/...` locale pages with server-rendered
translations.** These are the only keywords in the entire corpus where the
difficulty is low enough for an Authority Score 6 domain and the language pages
already exist. This is the single best-matched opportunity the data contains, and
it was invisible in the head+tail sample.

## C. The backlink profile is toxic, and it is growing

`/analytics/backlinks/overview/?q=doctalk.site`, same crawl date:

| Signal | Value |
|---|---|
| Referring domains | 191 (**+33%**) |
| Backlinks | 307 (**+24%**) |
| Referring domains at Authority Score **0–10** | **184 of 191 = 96%** |
| Domains at AS 41–90 | **0** |
| Top country by referring domains | **Singapore 40% (62)**, then **Moldova 11% (17)**; US 4 |
| TLDs | .com 50%, **.shop 8% (15)**, .in 6% |
| Semrush link graph verdict | **危险 / dangerous** |
| Link attributes | 75% follow |

### The anchor texts, read in full from the anchors report

Not truncated, not inferred — these are the complete strings, with their counts:

| Backlinks | Ref. domains | First seen | Last seen | Anchor text |
|---|---|---|---|---|
| 105 | **70** | 2026-06-28 | **2 hours ago** | `high quality dofollow backlinks da 50 pa 40 premium pbn network service doctalk.site rank first page google fast seo link building buy backlinks online cheap` |
| 13 | **13** | **9 days ago** | 5 hours ago | `expert manual outreach backlinks for doctalk.site designed to improve da, dr and tf. drive qualified visitors, across every niche and market.` |
| 184 | 107 | 2025-02-03 | 6 hours ago | `doctalk.site` (bare brand/URL anchor) |
| 1 each | 1 each | — | — | `live demo`, `try the live demo →`, `visit site`, `doctalk screenshot`, two blog URLs |

**83 of 191 referring domains (43%) carry an anchor that is literally an
advertisement for a link-selling service, naming `doctalk.site` inside the ad
copy.** Both campaigns are live: the first was last seen two hours before this
report, the second started nine days ago.

The genuinely earned links are the bottom row: six domains, total.

The most likely mechanism is the common PBN-vendor tactic of linking a target
domain from their network so the owner sees it in their own reports and buys the
service. Negative SEO and a past purchase are the other possibilities. **The owner
should confirm which** — if nobody bought links, this is unsolicited and the
response is purely defensive.

### What this does and does not establish

**This is not established as the cause of the low rankings, and I am not claiming it
is.** A six-month-old site with no earned links has an Authority Score of 6 for
entirely ordinary reasons, and Google's stated position since Penguin 4.0 is to
devalue links like these rather than penalise the site they point at. The honest
statement is narrower: the profile is **either suppressing rankings or being
ignored**, and until that is settled, no title, schema or internal-link change can
be read against ranking data. That makes it the first thing to resolve whichever way
it turns out — not because it is proven harmful, but because it is the one variable
that makes every other measurement uninterpretable.

This reorders everything in §6. Before any further on-page work:

1. **Investigate and, if confirmed, disavow.** Pull the full referring-domain list,
   classify it, and file a Google disavow. This is owner work (Search Console) and
   it outranks every keyword item in this document.
2. Check whether the growth is ongoing and from the same sources.
3. Only then judge on-page work — because until this is resolved, no title,
   schema or internal-link change can be evaluated against ranking data.

## D. Revised order

1. Backlink investigation and disavow (owner; blocks the ability to measure anything else)
2. Chinese and Spanish academic long tail on existing `/zh/` and `/es/` pages — KD 8–32,
   pages already exist, ICP-aligned
3. `ai with unlimited file uploads` (KD 21, ChatPDF absent) on an existing page
4. `humata` / `humata ai` (KD 38/53, ChatPDF absent) on the existing `/compare/humata`
5. Everything else in §6
