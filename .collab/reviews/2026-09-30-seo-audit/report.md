# DocTalk search + answer-engine audit — report (2026-09-30, rev. 2 after Fable review)

Design: `.collab/plans/2026-09-30-seo-audit-design.md` (Fable 5.1, incl. Amendment 1). Executor: Claude. Fable review of rev. 1: SHIP-WITH-FIXES (15 fixes, all applied below).
Evidence: `evidence/` (one file per step). Status labels follow the design §8: **PROVEN** (mechanism + timing + discriminating test), **CORRELATED** (timing only), **HYPOTHESIS** (untested), **KILLED** (a test that would have confirmed it came back negative).

## 0. Update after rev. 2 — the un-gated readout (owner-approved read-only production SQL, 2026-09-30)

This section supersedes the "partly measurement" caveat below wherever the two disagree. Source: `evidence/G0-B-C-2-prod-readout-2026-09-30.txt`.

| Week of | Signups | Activated signups | Landing CTA clicks | Anonymous demo sessions |
|---|---|---|---|---|
| 04-20 | 17 | 10 | — (event added 05-07) | 15 |
| 04-27 | 20 | 11 | — | 13 |
| 05-04 | 18 | 14 | 10 | 13 |
| 05-11 | 10 | 8 | 24 | 15 |
| 05-18 | 9 | 4 | 26 | 7 |
| **05-25** | **3** | **3** | **3** | **0** |
| 06-01 … 06-29 | 8, 5, 4, 1, 10* | 0, 0, 3, 0, 0 | 4, 1, 4, 3, 1 | 3, 1, 3, 0, 0 |
| Jul (4 wk) | 3, 0, 1, 1 | 1, 0, 1, 1 | 3, 1, 2, 5 | 3, 1, 2, 10 |
| Aug (5 wk) | 4, 4, 8, 5, 2 | 2, 2, 5, 4, 1 | 3, 4, 16, 9, 4 | 5, 6, 16, 2, 2 |
| Sep (4 wk) | 2, 2, 8, 0 | 0, 1, 5, 0 | 9, 4, 14, 2 | 24, 7, 7, 1 |

\* 06-01 (7) and 06-29 (9) are magic-link bursts with 0 activated, i.e. junk.

- **The cliff is real in server-side data, which is not consent-gated.** Activated signups ran 8–14/week from late April to mid-May and 0–5/week after 05-25. CTA clicks fell 26 → 3 and demo sessions 7 → 0 in the same week. **G0-C (iii) is now met**: the un-gated series drops in the same weeks as GA4's chatgpt.com. ChatGPT is named as the channel that stopped (**3 of 3**, F-3b → PROVEN on timing; the mechanism on ChatGPT's side remains unknown).
- The GA4 all-source step in the 05-23 week is therefore mostly **real**, not a capture artifact. The GSC-vs-GA4 Google coverage dip in Jun–Jul stands as a separate, smaller capture effect.
- The late-April burst was itself transient. ChatGPT first users rose 3 → 5 → 10 → 17 (weeks of 04-04 … 04-25), decayed through May (9, 6, 8), then stepped to 2. The shape fits ChatGPT picking DocTalk up for a set of answers in mid-April and dropping it around 05-23.
- **Diagnostics run after rev. 2, all KILLED as mechanisms on our side:** (a) the 05-23 blog template (the 05-24 build renders the full article, see C-6); (b) the home page before vs after the redesign (the 05-17 build `95269601` vs the 05-24 build `fbcd4dce`): identical title, description, canonical and JSON-LD types, and the same 24 unique internal link targets. Only the visible text shrank (941 → 697 words: the "See it in action" mock and one use-case section were removed). That is recorded, not a mechanism.
- Actions since rev. 2 are in `evidence/actions-log.md`: sitemap resubmitted, 3 URLs requested for indexing, `.collab` records pushed to main (53d3adfc).

## 1. Headline (rev. 2 — read §0 first)

GA4 counted about 70% fewer first-time visitors after May 2026. ChatGPT, until then the largest source, fell the most: 32 and 27 in April and May, then 4–10 a month. Two caveats come with that number. First, GA4 only sees visitors who accept cookies. In the week of the 05-23 deploy every source stepped down together, and GA4's capture of Google visitors fell to about a third for June–July. Part of the June cliff is therefore probably measurement. Even on months with comparable coverage (Apr–May vs Aug–Sep), ChatGPT is still down 60–75%, so the ChatGPT loss is real. Second, whether **signups** fell by the same amount is unread and waits on the owner's SQL. August was the best signup month since May, which argues they may not have.

Google organic was never a channel. It had 214 clicks in 16 months and sits at 1–2 clicks a day (it rose from June to August). Every mechanism we could test today came back negative: no crawler is blocked, the content is unchanged and fully server-rendered, the pages are in Bing, and there is no penalty. Four could not be tested this session. Perplexity does not name DocTalk for any of 6 category questions; ChatGPT, Google AI Overviews, Copilot and Gemini were not measured.

One indexing defect is proven and fixable with one click: Google has not read the sitemap since 05-24, and pages added since then, such as `/features/layout-translation`, are "unknown to Google". The spam-link campaign continues: 40 new domains since the disavow.

## 2. Gate 0 — where the visitors came from, and what stopped

### 2.1 Arrivals by channel (GA4 property 525157255, first-user source, consenting visitors only)

| Month | All first users | chatgpt.com | google | bing | (direct) | GSC clicks (un-gated) | GA4 coverage proxy (GA4 google ÷ GSC clicks) |
|---|---|---|---|---|---|---|---|
| Mar | 11 | 1 | 1 | 1 | 7 | 4 | — |
| Apr | 77 | **32** | 9 | 2 | 20 | 34 | 0.26 |
| May | 66 | **27** | 6 | 3 | 18 | 22 | 0.27 |
| Jun | 23 | **7** | 3 | 0 | 8 | 34 | **0.09** |
| Jul | 14 | **4** | 4 | 0 | 4 | 40 | **0.10** |
| Aug | 30 | **10** | 8 | 0 | 5 | 49 | 0.16 |
| Sep (1–29) | 23 | **5** | 7 | 0 | 7 | 31 (28 d) | 0.23 |

Mar–Sep total: 220 users; chatgpt.com 85 (38.6%), google 38 (17.3%). `accounts.google.com` (the OAuth return hop) is omitted. GA4 created its "AI Assistant" channel around June, so in the channel view April–May ChatGPT sits under "Referral". The coverage proxy is rough, because the Google counts are 3–9. Source: `evidence/ga4_acquisition_2026.md`.

**Weekly shape (the discriminating view).** chatgpt.com first users by week: 04-04 3 · 04-11 5 · 04-18 10 · **04-25 17** · 05-02 9 · 05-09 6 · 05-16 8 · **05-23 2** · 05-30 1 · 06-06 0 · 06-13 2 · 06-20 4 · 06-27 0 · 07-04 2. In the 05-23 week (the production deploy of the editorial marketing surface, the Wave-1/2 fixes and C1), **every source stepped down together**: total 18 → 6, direct 7 → 2, chatgpt 8 → 2. A step shared by all sources at a deploy date is the signature of a capture change. A real all-channel drop produces the same picture, and only the un-gated server series can separate the two. The cookie banner's code changed in that deploy (`cccb760c`, rAF debounce only). Its hide-when-a-dialog-is-open selector did not change, and no marketing component mounts a permanent modal, so **no mechanism was found**.

**Control ratio (C-1):** ChatGPT Aug–Sep ÷ Apr–May = 15/59 = 0.25; Google = 15/15 = 1.0. Seasonality or a uniform consent shift would move both. After scaling Aug–Sep to Apr–May coverage, ChatGPT is still around −60%.

**Pages ChatGPT sent people to (sessions):** Apr–May: `/` 16, `/blog/chatpdf-alternatives-2026` 12, `/blog/best-ai-pdf-tools-2026` 9, `/demo` 7, `/alternatives/notebooklm` 5, `/blog/best-ai-tools-academic-research-2026` 5. Jun–Sep (twice as long): `/` 5, the two listicles 3 and 0. All English pages.

**Labels (Fable ruling):**
- **F-3a PROVEN.** chatgpt.com first users among consenting visitors fell 60–78% while Google held steady. This is a direct measurement, and the control kills seasonality and a uniform consent shift.
- **F-3b CORRELATED.** "This is the signup drop the owner feels" waits on SQL-1/2/3. The 08-25 review recorded August as the best signup month since May (17), while ChatGPT first users in August were 10. The un-gated series may not agree.

### 2.2 Google organic was never the channel (G0-A, KILLED as a cause)

GSC `https://www.doctalk.site/`, 2026-02-13 → 09-27: 214 clicks, 28.6K impressions, CTR 0.7%, average position 16.8. Weekly clicks ran 0–16, and the pre-registered channel bar is ≥ 50/week. Monthly clicks rose from June to August (34 → 40 → 49). `/` took 94 clicks (44%). Source: `evidence/gsc_weekly_*.tsv`, `evidence/gsc_16mo_summary.md`.

### 2.3 The impression decline since August (G0-D — rule not applied; totals only)

The Aug-vs-Sep bucket split required by G0-D was not computed. This section reports 16-month totals only. Impressions peaked at about 2.5–2.6K/week in early August and fell to 744 in the 09-20 week, while the weighted position improved from 16 to 8.7. 42% of all impressions (12,152) sit on `/blog/best-ai-pdf-tools-2026` at position 8.3 with 11 clicks. 379 named queries are ≥ 8-word conversational questions (45% of named impressions, 0 clicks), the signature of AI-surface or LLM fan-out queries. Clicks did not fall. **CORRELATED** with AI-surface reporting at most; not actionable.

### 2.4 No penalty, no burst, no crawl cliff (G0-E, G0-F: KILLED)

Manual actions and Security issues both show "No issues detected". There are no Discover or News tabs. Crawl stats (90 d): 2.14K requests, 99% 200, no sustained drop after 09-21 or 09-27. The "host had problems" flag is a single `robots.txt not available` request on 2026-08-10 02:05, a blip. Source: `evidence/G0-E-F-gsc-health.md`.

## 3. Why did ChatGPT referrals fall? (sub-tree C)

| ID | Hypothesis | Test run | Result | Status |
|---|---|---|---|---|
| C-1 | Seasonality | ChatGPT vs Google control ratio | 0.25 vs 1.0 | **KILLED** |
| C-2 | GA4 capture changed at the 05-23 deploy | Weekly all-source step (05-23 week) + GSC coverage proxy (0.27 → 0.09) | A capture drop is visible and shared by all sources, but it cannot explain the Aug–Sep ChatGPT deficit at recovered coverage | **CORRELATED** (explains part of the June cliff; mechanism not found; decisive test = owner SQL-2/3) |
| C-3 | Bing (ChatGPT search's index) dropped us | BWT: sitemap read 09-28, 405 URLs; URL inspection of `/` and both listicles = "Indexed successfully"; impressions Apr–May 828/mo → Jun–Sep 454/mo (ratio 0.55 vs pre-registered bar 0.25) | The pages are in Bing. **Shapes differ:** Bing fell 27% May → Jun and then slid gradually, while ChatGPT stepped down in one week. [inference] The two listicles had only 111 and 20 Bing impressions in 12 months, so ChatGPT's April–May citations of them are unlikely to have come through Bing web ranking | **KILLED** as "dropped"; discriminating evidence **against** Bing as the mechanism |
| C-4 | OpenAI or Bing crawlers blocked | 81 fetches: 9 URLs × 9 UAs (Googlebot ×2, bingbot, GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, curl) | All 200, identical full HTML | **KILLED** for today. May–June Vercel firewall state is unreadable from here → HYPOTHESIS, owner check |
| C-6 | The 05-23 rewrite removed or changed what ChatGPT cited | `git log` 05-10..06-15; blog markdown for both listicles untouched from 05-06 to 08-26; bodies fully server-rendered today (16.7K / 18.2K visible chars) | Text unchanged. Build test (added after rev. 2): the stable state of 05-24 11:57 (`fbcd4dce`, contains the 05-23 template rewrite `a06e00c2`), built with `next build`, renders `/blog/chatpdf-alternatives-2026` with 16,626 visible chars and the body prose in the server HTML | Content **KILLED**; template-in-May **KILLED** |
| C-7 | hreflang made Bing swap the EN canonical | BWT inspection shows the EN URLs indexed | No swap | **KILLED** |
| C-5 | ChatGPT's answers no longer name DocTalk | ChatGPT (logged out) would not run a search in this browser | Not measured | **HYPOTHESIS** — owner login needed |
| C-9 | Freshness: the listicles ChatGPT cited are dated 2026-03-18 and were never updated | Frontmatter + JSON-LD `dateModified` = 2026-03-18 | Mechanism plausible, untested | **HYPOTHESIS** |
| C-8 | OpenAI-side change (residual) | — | Held while C-5/C-6/C-9 are open | Residual |

Evidence: `evidence/C-3-bing.md`, `evidence/C-4-C-6-crawler-and-diff.md`, `evidence/S-1.1-C-4-ua-matrix.txt`, `evidence/ga4_acquisition_2026.md`.

## 4. Findings, sorted by score

Score = impact (1–5) × confidence (0.25/0.5/1) ÷ effort (S=1, M=2, L=4). Items whose maximum effect is under 10 clicks/week sit at the bottom regardless of score (design §8 floor).

| # | Finding | Status | Evidence | Impact | Conf. | Effort | Score | Who |
|---|---|---|---|---|---|---|---|---|
| F-1 | **Google has not read the sitemap since 2026-05-24** (255 discovered; the live sitemap has 405). URL inspection confirms pages added since then are "URL is unknown to Google" with no referring sitemap: `/features/layout-translation` and `/zh/features/layout-translation`. The 09-20 "+14 d indexed" gate for the 11 layout-translation URLs therefore **failed**. `/es/use-cases/students`: "No referring sitemaps detected". Crawl Discovery is 4% of requests. (Some locale pages were still found via hreflang links, so the impact is not total.) | PROVEN (Sitemaps report + URL inspection) | `gsc_indexing_2026-09-30.md` | 3 | 1.0 | S | **3.0** | Owner (1 click) |
| F-6 | **Referrer capture is consent-gated**: GA4 and Vercel Analytics load only after cookie consent (`AnalyticsWrapper.tsx:24-35`), and `product_events` stores no referrer or UTM. This is exactly why §2.1 cannot separate a capture change from a real drop | PROVEN (code + §2.1) | `frontend/src/components/AnalyticsWrapper.tsx`, `frontend/src/lib/analytics.ts` | 3 | 1.0 | S | **3.0** | Code (~5 lines, Codex review) |
| F-2 | **101 "Crawled – currently not indexed"** (~86 real pages, mostly translated compare/alternatives/use-cases/features) plus EN posts. `/blog/ai-research-paper-summarizer` (the post behind the academic keyword cluster) is **not on Google**, last crawl 2026-04-26, and its Semrush positions are stale. At AS 6, translated commercial pages not being indexed is expected. Counts: 227 indexed, 113 not indexed, 65 sitemap URLs never reported | PROVEN (reason strings + URL inspection) | `gsc_indexing_2026-09-30.md` | 3 | 1.0 | S (request indexing on a few URLs only) | **3.0** → capped: only the request-indexing action | Owner (request indexing: `/es/use-cases/students`, `/blog/ai-research-paper-summarizer`) |
| F-3a | **ChatGPT first users (consenting) fell 60–78% while Google held** (§2.1) | PROVEN | `ga4_acquisition_2026.md` | 5 | 1.0 | — | diagnostic | — |
| F-4 | **Perplexity names DocTalk for 0 of 6 category/zh-academic questions** (tier d). The brand question resolves to OUR product and cites doctalk.site, so there is no entity collision on Perplexity. Cited sources are third-party listicles (atlasworkspace, otio, jotform, eesel, lynote, smallpdf, denser, aiplat.shanghaitech.edu). ChatGPT, AIO, Copilot and Gemini were not measured; Semrush's widget reports 4 ChatGPT and 4 AIO mentions | PROVEN by observation (Perplexity only) | `A-probes.csv` | 5 | 1.0 | L (outside code) | 1.25 | Outreach — outside constraints |
| F-3b | The ChatGPT decline is the signup decline the owner feels | CORRELATED (pending SQL; August signups argue against a 1:1 link) | §2.1 | 5 | 0.5 | — | — | Owner SQL |
| F-5 | **Spam campaign continues after the disavow**: 191 → 231 referring domains. Of 99 backlinks first seen 09-13..09-30, 59 come from already-disavowed domains and 40 domains are new (31 carry the two campaign anchors, 9 are bare-anchor `.site/.shop` SEO-service hosts) | PROVEN (observed) | `backlinks_new_20260913-20260930.tsv`, `../disavow-addendum-2026-09-30.txt` | 1 | 1.0 | S | 1.0 | Owner (upload once) — hygiene, not a ranking fix |
| F-7 | The two listicles ChatGPT used to cite are 6.5 months stale (C-9) | HYPOTHESIS | frontmatter | 3 | 0.25 | S | 0.75 | Gated intervention test, see §7 |
| F-8 | Bing ranks the brand (`doctalk`: 3.3K impressions, position 5.7) far better than Google (position 19.7; Semrush US #57 via `/contact`) | Observation | `C-3-bing.md` | — | — | — | — | — |
| F-11 | Semrush US: 29 keywords (−34%), 0 in the top 10 (`demo document` #6 on 09-19 is gone) | Observation | Semrush Organic Positions 09-29 | — | — | — | — | — |
| F-9 | `llms.txt` omits 11 EN sitemap URLs (`/features/free-demo`, `/features/layout-translation`, `/features/performance-modes`, `/trust`, `/privacy`, `/terms`, 5 blog categories) | PROVEN (diff) | this report | 1 | 1.0 | S | floor | Code |
| F-10 | Sitemap `lastmod` = build time on 386/405 URLs | PROVEN (curl) | — | 1 | 1.0 | S | floor | Code |

## 5. Killed hypotheses (so the next audit does not redo them)

- Google penalty or manual action — none (G0-E).
- Discover/News burst that ended — no such tabs (G0-E).
- Googlebot crawl cliff after 09-21 or 09-27 — none (G0-F). "Host had problems" is a single robots.txt blip on 08-10.
- Any crawler blocked or served a shell today, including OAI-SearchBot and ChatGPT-User — 81/81 OK (S-1.1/C-4).
- Blog content changed in the 05-23 rewrite — markdown unchanged, full SSR text present today (C-6, content part).
- ChatGPT landing pages dropped from Bing — all three indexed; the Bing decline has a different shape from ChatGPT's (C-3).
- Seasonality — the control ratio (C-1).
- `/ja` and `/zh` home thin — CJK tokenizer artifact: 2,326 / 1,817 visible chars, FAQ answers in SSR.
- Blog missing `datePublished` — squirrelscan false positive (JSON-LD Article + `article:published_time` present).
- squirrelscan "leaked secrets" — both false positives: a blog heading (`ai-document-security-privacy.md:139`) and Sentry's URL sanitizer (`t.password="%filtered%"`).
- Preview host `doctalk-liard.vercel.app` competing — canonical → www (S-1.4).
- Brand-name collision in answer engines — Perplexity resolves "DocTalk" to our product.

## 6. AEO scorecard (2026-09-30)

| Engine | Probes run | Tier a (doctalk.site cited) | Tier b/c | Tier d (absent) | Notes |
|---|---|---|---|---|---|
| Perplexity (logged out) | 7 of 20 | 1 (brand P-B1) | 0 | 6 (C2, C3, C4, C5, C6, Z1) | Logged-out quota stopped at query 8 |
| ChatGPT | 0 | — | — | — | Logged out; search did not execute. Claude did not sign in for the owner |
| Google AIO / AI Mode, Copilot, Gemini | not run | — | — | — | Next session |
| Semrush AI SEO toolkit | LOCKED on the reseller | — | — | — | Domain Overview widget: 14 mentions / 1 cited page (ChatGPT 4, AIO 4, Gemini 2), first measured 09-29; sources wisdomquant.com, pdnob.com, effortlessacademic.com |

## 7. What to do next (at most five)

1. **Resubmit the sitemap in GSC, then request indexing on `/es/use-cases/students`, `/blog/ai-research-paper-summarizer` and `/features/layout-translation`** (F-1, F-2). Read: within 48 h, GSC Sitemaps "Last read" moves past 2026-05-24; within 7 days "discovered" reaches 405; URL inspection for `/features/layout-translation` stops saying "unknown to Google". Owner, 5 minutes, or explicit approval for Claude to click.
2. **Owner runs SQL-1..SQL-3 (design §7).** This is the one test that decides F-3b and C-2: whether signups and the un-gated arrival series fell at 05-23 like GA4 did. Read the same day.
3. **Capture referrer and UTM without the consent gate** (F-6): store `document.referrer` host and `utm_source` in `metadata_json` on the first `landing_cta_clicked` / `auth_modal_opened`. Read: from the deploy, a weekly "arrivals by source" independent of consent. Code, effort S, Codex review.
4. **Measure ChatGPT directly** (C-5). The owner signs in to ChatGPT in the built-in browser, or runs the probes personally. Before that, run the C-6 build test (build `a06e00c2`, grep a body sentence of `/blog/chatpdf-alternatives-2026` in the built HTML, ~1 h, Claude). Read: same day.
5. **C-9 intervention test, gated on step 4 showing tier d on ChatGPT today.** Refresh `/blog/chatpdf-alternatives-2026` and `/blog/best-ai-pdf-tools-2026` with real updates (new `updated` date, current tools and prices), then re-probe P-C4, P-C1, P-C6 and P-C8 on ChatGPT and Perplexity at +28 days. Pre-registered read: tier a/b on ≥ 2 of the 4 probes → C-9 CORRELATED/supported; otherwise C-9 KILLED.

Separately (hygiene, does not block): upload the disavow addendum once, and add the GSC Domain property.

Outside the owner's stated constraints (listed once, not counted): getting DocTalk onto the third-party listicles that engines cite for category queries (F-4). This is the structural AEO lever, and it is outreach, not code.

## 8. Owner-only actions（中文）

1. **Search Console 重新提交站点地图**：GSC → 站点地图 → 输入 `sitemap.xml` → 提交。再到"网址检查"，对 `/es/use-cases/students`、`/blog/ai-research-paper-summarizer`、`/features/layout-translation` 各点一次"请求编入索引"。（也可以回复"批准 Claude 点"，我来操作。）**48 小时后复查**：Last read 是否已更新到 5 月 24 日之后，发现的网址数是否到了 405。
2. **跑设计文档 §7 的 SQL-1 到 SQL-4**，把输出贴给我。这是判断"注册数是不是也在 5 月 23 日掉了"的唯一办法（GA4 只能看到同意 cookie 的访客）。
3. **Vercel → 项目 → Firewall**：截图 Bot Protection / Attack Challenge Mode 的状态和变更历史（C-4 的 5 到 6 月部分）。
4. **在内置浏览器里登录 ChatGPT**（或者你自己跑测试问题），我来完成 ChatGPT 的实测（C-5）。
5. **disavow 补充文件**：`.collab/reviews/2026-09-30-seo-audit/disavow-addendum-2026-09-30.txt`（40 个域名，已定稿，不需要再挑）。在 Google disavow 工具里下载当前文件，把补充文件的行追加到末尾，再整份上传。只做这一次。
6. 回忆题：4、5 月有没有在别处发过 DocTalk？有没有当时 ChatGPT 推荐 DocTalk 的截图或对话？

## 9. Evidence index

- `evidence/00-access.md` — access; Semrush availability (AI SEO toolkit and Referring domains LOCKED; no Projects created)
- `evidence/gsc_weekly_2026-02-08_to_09-27.tsv`, `gsc_16mo_summary.md`, `gsc_indexing_2026-09-30.md` (incl. URL inspections), `G0-E-F-gsc-health.md` (incl. host blip, BWT filter options, secret triage)
- `evidence/ga4_acquisition_2026.md` — monthly and weekly source, source × landing page, coverage proxy
- `evidence/C-3-bing.md` — BWT performance, sitemap, URL inspection
- `evidence/C-4-C-6-crawler-and-diff.md`, `S-1.1-C-4-ua-matrix.txt`
- `evidence/A-probes.csv` — AEO probes
- `evidence/backlinks_new_20260913-20260930.tsv`, `../disavow-addendum-2026-09-30.txt`
- `evidence/S-2.7-squirrelscan-full.llm.txt` — full crawl (406 pages, score 68/D). Only crawl/index error-class rules count, and none fired

## 10. Open questions

- C-2 / F-3b: did signups and the un-gated arrivals fall at 05-23? Waits on owner SQL.
- What changed GA4 capture in the 05-23 week? No mechanism found in the banner or analytics code.
- C-5: ChatGPT's current answers (login). C-6: the template's SSR state in May–June (build test).
- Not run this session: Google AIO/AI Mode, Copilot and Gemini probes; the remaining Perplexity probes (quota); S-2.5 locale-market SERP checks; S-5.2 third-party profile inventory for `sameAs`.
- Why Bing impressions fell 72% from May to September while the pages stay indexed. BWT has no per-page history beyond the aggregate, and Chat is not separable from Web.
