# Pricing research — Fable's prior and the research design (2026-09-22, step 1 of 2)

Written by Fable 5.1 from `00-brief.md`, the strategy plan (`2026-09-22-next-strategy.md` §1, §2.3, §5, §9, §10),
the backlog rulings (`2026-09-03-backlog-decision.md` §9.3, §9.4, §9.14–§9.19, §9.25–§9.26), the 08-25 and 06-12
records, and the code paths the brief cites (`billing.ts`, `PaywallModal.tsx`, `billing.py`, `config.py`). Nothing
here changes a cap, a price or a nudge: strategy §5 / ruling 4.8 hold until 09-28. Step 2 (synthesis) follows the
worker outputs. The owner discussion happens later, in Chinese; this file is the working record.

## 1. Prior

1. **Keep freemium on the signed-in product; do not adopt "about three free tries, then pay" there.** The owner's
   observation bundles two claims: (a) *usage is episodic — one document, one job, one sitting* — probably true,
   and the owner-run script measures it; (b) *therefore shrinking Free would make those users pay* — does not
   follow. An episodic user does not want a $9.99/month subscription either, and that is the only thing any wall
   offers today (`billing.ts`: free → Plus monthly Checkout; `PaywallModal` takes the same path; packs lift no
   wall). The one sale ever was episodic (a 492-page file) and refunded the same day; the one post-A1 checkout
   (e8fed11b) was offered `plus/monthly` and never returned. So the live question is the brief's (d): **which unit
   Free is denominated in, and whether a one-off way to pay exists at the wall** — not freemium versus trial.
2. **The facts it turns on.** The credit allowance has bound once in seven months (`INSUFFICIENT_CREDITS` = 1);
   every intent event and the only sale came from *capability* walls — `file_size` (8 users, the sale, the post-A1
   checkout), `upload_limit` (6 users, mostly the 3-document cap), the demo `session_limit`, Domain Mode (11 of 17
   upgrade-clickers), export. "Too generous" is unmeasured at the credit level. A wall at message 4 would fire on
   ~31 of 164 signups, mostly *before* value (25 of 107 documents never opened; 31 of 68 session-openers stopped at
   1–2 messages; 0 of 67 reached a fourth active day): it converts the unactivated, not the satisfied — a
   mechanism, not a statistic. And **DocTalk already runs a hard trial** on the anonymous surface (5 messages per
   IP per demo document per 24 h): the 34 anonymous sessions since T_A averaged 1.2 messages, so nobody reaches it.
   The competitors the owner sees are mostly no-account trials; strategy §2.3 (anonymous upload with demo caps) is
   DocTalk's version of that, so "three tries" and §2.3 are not opposites — the hard trial belongs before sign-in,
   and the signed-in tier keeps capability walls.
3. **Two constraints settle half of question (c) now.** Any time-boxed trial — opt-in, opt-out or reverse — fires
   its conversion moment on day 7 or 14, and 0 of 67 users have ever been present on day 4: nobody is there when
   the trial ends, and the reminder channel that rescues late converters (e-mail) is vetoed. On a code-only
   product the only conversion mechanism is an in-product wall met during the first sitting. And acquisition is
   SEO on an AS-6 domain: the one ranking cluster is the academic post `/blog/ai-research-paper-summarizer`
   (14 of 37 ranking rows, positions 62–93 — the students cohort's entry, price-sensitive by definition), while
   ~40 strings × 11 locales plus titles, descriptions and FAQ JSON-LD promise "free" / "no credit card" / "no
   signup" (the brief's §5 calls `/blog/free-ai-pdf-chat-no-signup` the ranking post; the Semrush read says
   otherwise — §3.2 item 5 settles which pages rank for which queries). A hard trial rewrites all of that copy and
   removes the funnel's top before pricing can act.
4. **What would change it.** The script cell *own document · citation click > 0 · no wall · first-to-last span
   < 1 day · > ~100 credits spent* dominating the real-work population: users get full value from one document
   and leave satisfied, so the free *unit* is wrong (credits → documents or pages, which competitors sell and users
   can read) and a one-off unlock at that unit becomes the candidate — still not "three tries", still nothing
   before 09-28. If instead most churn sits in "uploaded, never chatted" and 1–2 messages, pricing is not the lever
   at all and activation (B1, the bridge) stays the list.

### Rulings — keep / amend / overturn

| Ruling | Verdict | Reason |
|---|---|---|
| §9.3 "price/value is the wall" needs `checkout_created` ≥ ~5 | **Keep**, with a distinction | Price *level* is undecidable at this traffic. Packaging *shape* — the unit Free is measured in, whether a one-off option exists beside the subscription — is a different claim, decidable on reasoning plus external evidence. This research decides shape, never level, and proposes nothing before 09-28. |
| §9.4 / 08-25: no price moves on one data point; "don't cut price" | **Keep** | Nobody has mentioned price; margin ≈93%. |
| 08-25: "Free has no wall is an unpulled pricing lever" | **Amend** | Free has no *credit* wall. Its capability walls fire and produce every intent event; the lever is the unit and the option at the wall, not the credit count. |
| 08-25: credits are an unreadable value unit | **Keep, and act on it** | Every competitor row in this research is recorded in the unit the product sells (documents/day, pages/month, questions/day) so the readability gap is measured, not asserted. |
| §9.15 / §9.18: the 3-open-conversations-per-document cap stays | **Keep** | It bound one user, once, on a demo document. Not a pricing lever. |
| Strategy §5 / ruling 4.8: 09-28 is decision day; no product-wall change on unread data | **Keep** | This file produces a candidate for the 09-28 list, not a change. |
| §2.3 anonymous upload with demo-grade caps | **Keep**, reframed | It *is* the "a few free tries" model, placed where it belongs (before sign-in). Its caps (5 messages, 1 document) should be designed as the trial, deliberately. |
| Owner constraints: code only, no outreach, no lifecycle e-mail | **Keep** | They rule out every model that converts at trial end by e-mail. |

## 2. Research design

Four worker tasks, parallel, each self-contained. Due **2026-09-24 12:00 CEST**; synthesis on 09-25; owner
discussion before 09-28. Sonnet for T1 and T2; **use a stronger model (Opus) for T3 and T4** — their failure mode
is a confidently cited number or statute that is not at the URL.

### 2.0 Rules that go verbatim into every worker prompt

> **Safety.** Do not sign up for anything, do not enter any personal data (no e-mail, name, card, phone), do not
> accept terms, trials or consent flows beyond what cookie-free reading of a public page requires. If a price or
> limit is only visible after login, write `not visible without signup` — never infer it. Read App Store / Google
> Play listings (the "In-App Purchases" section) and public help-center pages as signup-free price sources.
>
> **Verification.** Every number carries the URL it was read at and the access date (`YYYY-MM-DD`). Reproduce the
> exact sentence or table cell the number comes from. Anything taken from a review site, blog or AI summary rather
> than the vendor's own page is marked `secondary` and is not reported as fact. Mark every unverified claim
> `unverified`. Do not fill gaps from memory.
>
> **Context you need (DocTalk today, verified 2026-09-22).** Sign-in is required to upload. Free: 500 credits once
> at signup + 300 per month that never expire (a Flash answer ≈ 5 credits, a Pro answer ≈ 15); 3 documents; 3 open
> conversations per document; 50 MB / 750 pages per file; 20 Pro-model answers per month; no export. Plus $9.99/mo
> (annual −20%): 3,000 credits/mo, 20 documents, unlimited conversations, 100 MB / 1,500 pages, export, Domain
> Mode. Pro $19.99/mo: 9,000 credits, 999 documents, 200 MB / 3,000 pages. One-off credit packs 500/$3.99,
> 2,000/$9.99, 5,000/$19.99 — they add credits only and lift no wall; every wall a free user hits offers only a
> monthly Plus subscription. Anonymous visitors get 3 demo documents at 5 messages per IP per document per 24 h.
>
> **Format.** Markdown only, one file at the given path, the fixed table schema below, one access-date line at the
> top of the file, a final `## Gaps` section listing what could not be verified and why. No recommendations —
> facts and their sources.

### 2.1 T1 — English-market competitor audit → `10-competitors-en.md`

**Goal.** Verify, tool by tool, the owner's observation that competitors "give about three free tries, then require
payment"; record each product's free-tier terms, paywall trigger and one-off options in the unit it sells.

**Questions.** For each product: (1) Can a visitor use it before creating an account, and what stops them?
(2) What exactly is free, in the product's own unit (documents/day, pages/document, questions/day, MB, models)?
(3) What is the paywall trigger — usage cap (rolling or lifetime), trial count, time-boxed trial, card-upfront
trial, or a feature gate — and does it literally give ~N uses then require payment? (4) Prices, monthly and
annual. (5) Any one-off way to pay: day pass, weekly plan, credit pack, per-document or per-page overage.
(6) Student/edu pricing. (7) Payment methods visible on the pricing or checkout page without logging in.
(8) What the product's public "free" page promises (its title and first claim), because DocTalk's acquisition is
"free"-intent search.

**Products (≥ 8 complete rows required; cover the first 8 first, then as many of the rest as the stop condition
allows).** ChatPDF (chatpdf.com), ChatDOC (chatdoc.com), AskYourPDF, Humata, PDF.ai, Sharly AI, Docalysis,
Anara (formerly Unriddle), SciSpace (typeset.io), Elicit, Google NotebookLM, Adobe Acrobat AI Assistant, Scholarcy,
Consensus, Paperpal. Older internal notes (Feb 2026) exist for several of these —
`.collab/plans/competitor-benchmark.md` and `.collab/plans/competitive-gap-analysis-2026.md` — treat them as leads
to re-verify, not facts; where today's page contradicts them, record the change with both dates.

**Schema (one row per product; every cell filled or `not visible without signup`).**

| # | Product | URL(s) · access date | Account before first use? (none / email / card) | Free tier, in its own unit | Paywall trigger type | "≈N free uses, then pay?" — yes/no + exact mechanism | Prices (monthly / annual, currency) | One-off options (day pass / weekly / pack / per-doc / overage) | Student / edu | Payment methods visible | Free-page promise (title + first claim) | vs DocTalk Free: more / less / same, one clause why |

**Stop.** ≥ 8 rows with every column filled or explicitly `not visible`; cap 15 products; stop at 3 hours of work.

### 2.2 T2 — Chinese-market and Spanish-market audit → `11-competitors-zh-es.md`

**Goal.** Find what a Chinese-speaking or Spanish-speaking user actually meets when they look for "AI to read a
PDF / paper for free", and whether the "a few free uses, then pay" pattern the owner has seen lives there.

**Questions (zh).** Separate two classes and label each row: *general chatbots* that read documents as a feature
(Kimi / Moonshot, 豆包 Doubao, 通义千问 Qwen app, DeepSeek app, 腾讯元宝 Yuanbao, 文心一言/文小言) versus
*document / paper tools and 小程序* where per-use paywalls live (秘塔AI搜索 Metaso, WPS AI, ChatDOC's Chinese
presence, 讯飞星火文档问答, 知网 AI 学术研究助手, PopAI, 知乎直答, plus any tool ranking on Baidu for 论文ai /
读论文 ai / 文献阅读 免费). For each: same eight questions as T1, plus (9) which surface (web / app / 小程序)
carries the paywall, (10) the price source used (pricing page / App Store IAP list / Google Play IAP / help
center), (11) whether the "N free uses then pay" mechanism is literal (a counter) or a daily quota. Many zh
pricing pages require WeChat login: use the App Store's In-App Purchases list and public help pages; record
`not visible without signup` otherwise.

**Questions (es).** Define the market operationally: the top results for `chat con pdf gratis`, `ia para leer pdf
gratis`, `ia para investigar gratis` from es and mx (note which SERP you could see), plus the es localisations of
ChatPDF, Humata, AskYourPDF, Sider and ChatGPT. For each: the T1 questions; payment methods for Spain (cards,
Bizum, PayPal) and Latin America (OXXO, Mercado Pago, PSE, local cards) as visible on the vendor page.

**Schema.** T1's schema plus three columns: `Market (zh/es)`, `Class (general chatbot / document tool / 小程序)`,
`Price source (pricing page / App Store IAP / Google Play IAP / help page)`.

**Stop.** ≥ 6 zh rows (≥ 3 of them document tools or 小程序) and ≥ 5 es rows, every column filled or `not visible`;
cap 16 rows; stop at 3 hours.

### 2.3 T3 — What the evidence says → `12-evidence.md`

**Goal.** Establish, from named sources verified at the source, what is known about free-to-paid conversion under
freemium, hard trial or hard paywall, reverse trial, opt-in and opt-out free trial — and about one-off pricing
(day pass, weekly, packs) — for four cases: (i) a low-traffic, SEO-acquired product; (ii) an episodic, one-off
document job; (iii) AI tools; (iv) students.

**Sources to cover (verify each at its own URL; add others only if primary).** RevenueCat *State of Subscription
Apps* 2025 and 2026 (trial→paid rates, hard vs soft paywall, weekly plans, AI-app category); OpenView *Product
Benchmarks* (freemium vs free-trial conversion, PLG) and Kyle Poyar's *Growth Unhinged* posts on reverse trials;
Lenny's Newsletter on free-to-paid conversion benchmarks; Paddle / ProfitWell (Patrick Campbell) on freemium and
trials; ChartMogul SaaS benchmarks; Piano and INMA reports on hard vs metered paywalls and day passes (publishers —
cross-domain, say so); any primary source on student pricing conversion (Spotify/Apple student tiers count only if
a number is published); press-reported AI-tool conversion (e.g. the share of ChatGPT weekly users who pay) marked
`press-reported`.

**Questions.** For each claim: what number, measured on what population, over what period; whether it is at the
URL; and, for each of the four cases, one clause "applies because …" or "does not apply because …" (RevenueCat is
mobile consumer apps; OpenView is B2B SaaS; publisher studies are news). Then, separately: what the evidence says
about **subscription versus one-off** for episodic use (weekly plans, day passes, packs) — question (d) — and about
trials that depend on trial-end e-mail (DocTalk cannot send any).

**Schema.**

| # | Claim (one sentence) | Number(s) | Population measured | Period | Source title · URL · access date | Verified at source? (exact sentence reproduced / partial / secondary only) | Model it speaks to (freemium / hard trial / reverse trial / opt-in trial / opt-out trial / one-off) | (i) SEO-acquired: applies because/despite … | (ii) episodic job | (iii) AI tool | (iv) students |

**Stop.** ≥ 15 verified rows across ≥ 6 distinct primary sources, each of the four cases addressed by ≥ 3 rows,
question (d) addressed by ≥ 3 rows; unverifiable claims listed under `## Gaps` rather than in the table; stop at
3 hours.

### 2.4 T4 — Cross-constraints: law, card networks, payment rails, "free" search intent → `13-constraints.md`

**Goal.** Establish what a Germany-based sole operator must do to run (1) an auto-renewing subscription, (2) a free
trial that converts to paid, (3) a one-off purchase of digital content; which payment methods Stripe supports for
one-time versus recurring for Chinese and Spanish-speaking customers; and whether "free" is a required promise to
rank in this category.

**Section A — EU and German consumer law.** BGB §312j (Button-Lösung, "zahlungspflichtig bestellen"), §312k
(Kündigungsbutton), §309 Nr. 9 (auto-renewal and notice limits, 2022 reform), §356 Abs. 5 (loss of the 14-day
withdrawal right for digital content: consent + acknowledgement), Preisangabenverordnung (total price display),
UWG on dark patterns; EU Consumer Rights Directive Art. 8(2) and Art. 16(m); the status of the EU Digital Fairness
Act (proposal, expected content on subscriptions and trials). For each rule: what it requires for (1), (2) and
(3). Cite the statute text (gesetze-im-internet.de, eur-lex.europa.eu) — not law-firm summaries alone.

| Rule | Citation | Requirement for (1) subscription | (2) trial → paid | (3) one-off digital purchase | Source URL · access date | Verified? |

**Section B — Card-network and Stripe trial mechanics.** Visa and Mastercard rules for free trials and recurring
billing (pre-charge reminder, explicit consent, cancellation), Stripe's documentation for `trial_period_days`,
`payment_method_collection: if_required`, `trial_settings.end_behavior.missing_payment_method`, and one-time
`mode=payment` Checkout. Same table shape.

**Section C — Stripe payment-method matrix (the discriminator for one-off versus subscription).** For Alipay,
WeChat Pay, UnionPay, OXXO, Mercado Pago (if any Stripe path exists), Bizum, PayPal, SEPA Direct Debit, Klarna,
Apple Pay / Google Pay: one-time supported? recurring supported? customer countries? available to a Germany-based
Stripe account? Read Stripe's own payment-method pages.

| Method | Customer countries | One-time (`mode=payment`)? | Recurring (`mode=subscription`)? | Available to a DE Stripe account? | Source URL · access date | Verified? |

**Section D — Is "free" a required promise in this category?** Google autocomplete and Google Trends (relative
interest) for `chat pdf` vs `chat pdf free`, `chatpdf gratis`, `论文 ai 免费` / `读论文 ai`, `ia para leer pdf
gratis`; for the top 5 results of `free ai pdf chat` (en) and the zh/es equivalents, what the page title promises
(free / no signup / trial / nothing).

| Query · locale | Evidence type (autocomplete / Trends / SERP) | What the top results promise | URL · access date |

**Stop.** Section A ≥ 8 rules, B ≥ 4 rows, C all 10 methods, D ≥ 6 queries; every row cites a primary source or is
marked `secondary`; stop at 3 hours.

## 3. Internal data

### 3.1 Changes to `free_quota_at_churn.py` — before the owner's single run

The script already answers "where did each user stop" (§1–§6). It cannot yet separate *stopped by a wall* from
*worked around it*, nor test the owner's hypothesis as a count. Add, read-only, prefixes only:

1. **Wall timing and what followed.** For each user in "hit a wall": was the first wall event before or after their
   first user message, and before or after their first `citation_clicked`; user messages after the first wall
   (0 = stopped, > 0 = kept going). Split every wall by `metadata_json->>'is_demo'` (present since T_copy; rows
   without the key flagged) — a demo `session_limit` is evaluation, not depth.
2. **`upload_limit` is a catch-all** (`DashboardPageClient.tsx:334`, `:530`: any upload rejection whose CTA is not
   `file_size`). Split it by the error code if `metadata_json` carries one; otherwise print it as "document cap or
   other upload error" and say so.
3. **Counterfactuals by document and by time**, beside the message-N table: users who would have been stopped by a
   trial of 1 own document / 2 own documents (`own_docs ≥ N+1`), and users with any user message or upload after
   day 7 / day 14 from their first activity (what a time-boxed trial would have cut).
4. **The hypothesis cell, as counts.** Among "real work" users (≥ 3 messages or a citation click), a table of
   own-document vs demo-only × cites > 0 vs 0 × span < 1 day vs ≥ 1 day, with median credits spent per cell.
   The owner's population is *own · cites > 0 · < 1 day*; the activation-failure population is *cites = 0*.
5. **The two other free caps.** Did `pro_mode_limit` (20 Pro answers/month) or the 3-document cap ever fire,
   and for how many users (§2 may show it; make it a named line). Also per-user count of Pro-mode messages: ledger
   rows with `reason='chat'`, `ref_type='mode'`, `ref_id='balanced'` (`chat_service.py:1816`, `:2896`), and how many
   users reached 20 in any 30-day span.
6. **Job size.** `documents.page_count` p50 / p90 for own documents of real-work users versus everyone else, and
   the share of real-work users whose first own document exceeds 100 pages.
7. **First-session depth.** User messages in each user's first session (median, p75) and the count of users whose
   whole lifetime is one session with ≥ 3 messages — the "one job, done" signature.
8. Keep §6's 15-row sample; add `own_docs`, `sessions` and `pages of largest doc` to each row.

### 3.2 Questions Claude answers from the repository

1. Confirm no surface a *free* user can reach from a wall offers a credit pack or a one-off purchase — `billing.ts`
   `free → checkout`, `PaywallModal` → `startPlanAwareBillingAction`, the session dropdown, the Domain Mode
   selector, the upload precheck. (My reading: none does; packs are reachable only by navigating to `/billing`.)
2. A real count of the marketing strings that state the free allowance or promise "free" / "no credit card" /
   "no signup", per locale key (the brief says ~40; a `grep` for "free" returns 296 matches and is noise). Include
   titles, meta descriptions and FAQ JSON-LD keys separately — that is the copy cost of any change.
3. What `fix/free-credit-copy` @ `a179c80` changes, in one paragraph, so the synthesis does not propose a string
   that branch already rewrites.
4. Whether `limit_hit` / `paywall_opened` metadata carries the backend error code (for §3.1 item 2).
5. Which DocTalk pages rank for which queries, from `.collab/reviews/2026-09-20-jev-seo/keyword_triage.json` and
   `findings.md` §2: is any "free"-modified query among the 37 ranking rows, and does `/blog/free-ai-pdf-chat-no-signup`
   rank for anything? This decides how much of the "free" copy is load-bearing for acquisition versus merely present.

### 3.3 Owner-only

- Which payment methods are enabled in the Stripe Dashboard (Checkout does not pin `payment_method_types`,
  `billing.py:678`, `:885`); whether Alipay / WeChat Pay / OXXO / PayPal are on.
- Run the amended `free_quota_at_churn.py` once, after §3.1 lands.

## 4. Question (e), stated now so no worker is asked to design an experiment

At 0.31 signups/day and ~2 anonymous demo sessions/day, four to eight weeks yield 9–17 signups. No conversion
comparison between two packagings is readable at that n — not an A/B, not a before/after. What *is* readable at
any n is an existence event, the same logic as §9.3: the first one-off purchase at a wall, if a one-off option
existed; the first anonymous-upload claim, if §2.3 ships. The synthesis will say so plainly, and will recommend on
reasoning plus the four files above — "none; decide on reasoning" is the expected answer to (e).

## 5. Step 2 — what the synthesis returns

A recommendation on the shape of Free and of the wall (unit; one-off option or not; where the hard trial lives),
the strongest argument against it, the evidence that would flip it, where I disagree with the owner's framing
(shrinking Free versus selling the episodic job) and with Claude's brief (its (c) list treats trial models that
need e-mail as live options), and the candidate item for the 09-28 list — not an implementation plan.
