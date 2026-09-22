# Needs analysis — synthesis (Fable 5.1, 2026-09-22, step 2 of 2)

Answers the owner's two questions from `README.md`: (1) is the product failing to meet users' needs, and is
that — more than price — why almost nobody returns; (2) given cost, how should pricing be designed and does the
system's capability need to rise. Inputs: the plan (`01-plan-fable.md`), the cost note (`02-cost-to-serve-claude.md`),
the tables (`04-tables-claude.md`, all cited as T‑§), the four coder summaries, the churn read
(`../2026-09-22-pricing-research/free-quota-at-churn.txt`, cited as C‑§), the pricing synthesis
(`20-synthesis-fable.md` with `04-claude-after-synthesis.md`), and my own reading of the anchor users' transcripts
(plan §3.4: the payer, the four returners, both 20-message sessions, every August own-document session, the
unanswered-message contexts, the error-document owners). Everything below is aggregate; examples are paraphrased;
no run of more than eight words from any conversation appears; users are 8-character prefixes already in committed
files, or unnamed.

## 0. The answer in six lines

1. **The owner's suspicion is right about the product of February–May and wrong about the product since August.**
   Of the 24 users whose history says "needs unmet", 22 last used the product before the 05-24 retrieval fixes;
   2 used it after (T‑4.2). The failure classes that drove May's churn — lost answers, page lookups, terse-query
   refusals, jargon, the eight-fragment ceiling — are absent or nearly absent from August (T‑4.3 failure × era).
2. **What explains the return rate now is not one thing but three, in this order:** never activated (30 users:
   uploaded and never opened, parse failed, or a wall before the first message), the job done in one sitting with
   nothing to come back for (24 users; the owner's own cell decides Read B: 10 of 16 finished the job), and
   needs unmet (24, mostly historical). Silence is the largest single signal: 58 of 93 sessions end with an answer
   and no reply, 31 of them with no failure anywhere (T‑4.4).
3. **The needs still unmet in the current product are few, specific, and sit in the cohorts that could pay.**
   Eight of the eleven August own-document users finished their job; the three who did not were stopped by
   exhaustive work over a long document (a 517-page past-paper compilation answered from "sections reviewed"), a
   table the document may not contain, and the credits wall. Around them: the document-only rule refusing writing
   help and general knowledge that students ask for (author's life, a song, a merged presentation), truncated long
   answers, and the verified-quote workflow that the retained cohort performs by hand — 3 of 3 August users who
   asked for quotes or locations clicked citations and never saw Quote Finder.
4. **Capability, ranked by users × evidence ÷ cost:** ship the citation→quote bridge (built); relax the scope
   rule to "document-first, labelled" (a policy change, days); add a user-triggered whole-document mode for long
   files (≈ 19 credits an answer at Flash cost, ~2 weeks); fix truncation and the comparison-misroute; make export
   discoverable. Do not build speed, language, OCR or bigger-file work on this evidence.
5. **Pricing:** Free is one intense day, not a month — the two heaviest August users burned 520 and 460 of their
   500 one-time credits in a single day (one hit the credits wall and clicked upgrade at $9.99/month; neither paid).
   Users think in pages and documents, never credits; 1 of 67 mentioned price; none named an alternative. The
   pricing synthesis stands with three amendments: fix the monthly grant so "renewing" is true; put a
   **7-day document pass with its own credit bundle** beside Plus at every wall including the credits wall (Read B);
   rewrite the readable unit with real numbers (500 credits ≈ 45 ordinary answers; ≈ 20 in the one long-document
   working day observed).
6. **Cost is not the constraint.** LLM spend on every non-owner user ever is $1.57; ordinary answers keep ≥ 80%
   margin at the Plus credit price. The one thing to price deliberately is a whole-document answer: $0.06 over a
   289-page file, which the current per-token rate table would reconcile to about 200 credits — two-fifths of the
   signup pool — so it needs its own flat per-document price with the per-page pass cached. Engineering days are
   the only scarce input, and the owner's.

## 1. What the corpus is, and what it cannot say

97 registered users were coded (67 with conversations, 21 upload-only, 9 events-only), 93 sessions, 182 anonymous
demo sessions; three coders agreed with May's ground truth on the payer and with each other on 23 of 28
calibration turns for outcome (14 of 28 for the exact failure set — failure attribution is the soft field, and I
have read the anchors myself rather than trust it blind) (T‑4.1). Coverage is complete; every file passed the
validator.

The corpus is old. 66 of 93 registered sessions predate the 05-24 fixes (E0); 9 fall in the June–July window where
the backend sat in the wrong region (E1); 18 sessions (15 on their own documents) from 11 users describe the
product since the 08-08 latency fix (E2); no registered session exists after T_A (E3), only 34 anonymous demo
sessions. So "does today's product
meet needs" rests on eleven users and the demo. Where I say "today" below I mean that evidence and say so.

Two coder flags I accept as caveats: a handful of "unanswered" turns are answers that arrived inside the previous
reply's continuation (two users), so the 28 lost answers slightly overstate the E0 defect; and four anonymous
E0 sessions on the earnings demo were coded as inconsistent on one revenue figure across sessions, which is
outside the codebook's hallucination rule and stays at medium confidence.

## 2. Question 1 — are needs unmet, and is that why nobody returns?

### 2.1 Three explanations, measured

| explanation | users voting | where they sit |
|---|---|---|
| H3 never activated | 30 | 29 with no session at all: 21 uploaded and never opened a chat (7 of them because the parse failed — 10 `VECTORIZE_FAILED` documents from the April incident), and 8 events-only users met a wall before any message |
| H1 needs unmet | 24 | 22 last active in E0, 2 in E2 |
| H2 episodic, done in one sitting | 24 | 15 E0, 2 E1, 7 E2 — the only explanation that grows in the recent era |
| H5 reliability | 23 | 27 of 27 lost-answer turns are E0; 8 of the 23 are parse errors; truncation is the residual (7 turns, E1/E2) |
| H6 walls | 14 | 11 never sent a message; the wall came first |
| H8 job mismatch (writing, outside knowledge, export) | 14 | 9 E0, 3 E1, 2 E2 |
| H10 differentiator invisible | 11 | 4 in E2 |
| H4 document class | 9 | 6 E0, 2 E2 |
| H7 trust, H9 alternative | 7 each | T‑4.2 |

(T‑4.2; a user can vote for several.)

Among users who chatted, the final leave reason is `job_done_satisfied` 21, `gave_up_after_failure` 19,
`job_done_partial` 8, blocked by a missing answer 5, evaluation only 5, blocked by a wall 3, parse error 1, unclear
5 (T‑4.2 by segment). 42 of 67 chatters had at least one need the product did not meet somewhere in their history —
but see the era split before reading that as present tense.

**The owner's cell, decided.** The 16 "own document · cited · left within a day" users (C‑§9) split
`job_done_satisfied` 9 (6 high, 3 medium), `job_done_partial` 1, `gave_up_after_failure` 4, `blocked_by_wall` 2
(T‑4.4). By the rule fixed in the plan (§5.2), 10 ≥ 8 at medium-plus confidence → **Read B**: the "solved and
left" reading is confirmed as the largest real-work pattern, and the non-renewing pass becomes the first
packaging item after 09-28. Nine of the sixteen had no unmet need at all; seven had one (page navigation, export,
tables, long-document coverage), so "solved" and "unmet" overlap inside the same short visit.

### 2.2 What "unmet" was, by era — what is fixed and what is not

Failures by era (turn level, T‑4.3): lost answers 27 → 0 → 0; page or item lookups failed 10 → 0 → 0;
retrieval miss asserted by the user 15 → 1 → 0; jargon or confusing UI 9 → 0 → 0; garbled text 4 → 0 → 0;
generation refused 6 → 0 → 0. Those are May's reasons B1, B2, B5, B6 and B7, and they are gone from the August
sessions. What remains in August (E2): "not in the document" replies the transcript cannot verify 12 (mostly one
user's eight rephrasings about a co-accused's statements in a 160-page ruling — on my reading, honest negatives:
the ruling records the charge, not the testimony), over-rigid scope 4, incomplete coverage of a long document 4,
incorrect statements 3, wrong or missing citation 2, truncation 1, one table extraction.

Needs unmet across the corpus, users (T‑4.3 met/unmet): fast reliable answer 14 (0 met — this is the lost-answer
class, historical), outside-document knowledge 8 (0 met, by policy), export or download 7 (0 met — the feature
exists behind Plus and the chat refuses instead of pointing to it), writing or drafting 6 met 5, page or item
navigation 5 met 3, tables or numbers 5 met 2, scanned or garbled text 5 met 0, long-document coverage 5 met 0,
verbatim quotes with pages 4 met 2. What the product does well is equally clear: whole-document summaries 19 met
against 4 unmet, concept explanation 17 against 2, page-cited answers 14 against 2, cross-lingual work 4 against 1.
The sweet spot May found — a document under 40 pages, a focused question — is still where the product is strongest:
33 of 61 first own documents were 40 pages or fewer, and those sessions carry almost no failures.

**The present-tense unmet needs, from the eleven August users, read one by one:**

- *Exhaustive work over a long file.* An admissions candidate asked for every past-paper question on one topic
  from a 517-page compilation, with year, number and page, in Pro mode; the answers listed what the retrieved
  sections held, mixed in off-topic items, gave loose page ranges, and the count contradicted the list. Five
  citation clicks, gone in three minutes, never back. This is the payer's failure class surviving the fixes, in a
  smaller form: retrieval finds passages; it cannot enumerate a document.
- *The document-only rule.* Three separate August users were refused things the document cannot contain and a
  general assistant answers without thinking: a novel's author and context (two students working on the same
  classic, one of whom re-uploaded it three times over twelve days and clicked 44 citations), the identity of a
  song and an anime reference in a fiction excerpt (the assistant first claimed to recognise the song, then
  could not name it, then declined until the user supplied both), and merging three scanned reports into one
  presentation (first "cannot merge", then "the sources say nothing about presentations", then an outline of bare
  numbers). Across all eras 45 turns asked the assistant to write and 10 asked for outside knowledge; the refusals
  cluster in E0 (7) but persist (2 refusals and 3 outside-knowledge asks in E2). May's B4 had five users; the coded
  corpus has eight, plus the payer.
- *Truncation.* Three answers cut mid-sentence for the Italian legal user in July (who also received two canned
  English replies after a misroute to the document-comparison action — the E1 routing bug the coder flagged), one
  cut table in August. Small, cheap, and it lands on the deepest users because their answers are longest.
- *Verification by hand.* The three August users who asked for quotes, locations or page mappings clicked
  citations 20, 44 and 8 times and never opened Quote Finder, which was live throughout (T‑4.3 qtype; 12 of 23
  verbatim-quote turns in the corpus are by citation clickers). That is §9.17's 0 of 19 reproduced in the era
  where the feature existed, and it is the mechanism argument for the bridge (strategy §2.1), now with three
  post-launch instances.

### 2.3 Episodic versus unmet — which explains the return rate

- Return, defined as the 0.149 base does, happens for 5 of 22 users whose first answer satisfied, 4 of 13 partial,
  0 of 9 unsatisfied, 0 of 17 unknown, 1 of 6 missing (T‑4.4). A bad first answer ends the relationship; a good
  one buys a one-in-four chance of a second day.
- Recurring jobs return more than one-off ones (8 of 29 against 2 of 8), but 21 recurring-job users never came
  back; their final reasons are gave up after failure 8, job done 7, partial 3 (my cross-tab from the coded
  records), and 15 of the 21 are E0 users. In the recent era, two of eleven own-document users returned on a
  later day; of the other nine, four left satisfied, two partly done, two gave up (the 517-page enumeration; a
  table the document may not contain) and one was stopped by the credits wall.
- Unknown is the honest majority: 58 of 93 sessions end in silence, 31 with no failure on any turn. The coders
  never counted silence as satisfaction; the numbers above are lower bounds on "done".

**Verdict.** For the product users met between February and May, unmet needs were the dominant cause — B1/B2/B6
plus the fragment ceiling drove the churn May diagnosed, and the corpus confirms it at 22 of 24 H1 votes. For the
product since August, the dominant patterns are "never activated" and "done in one sitting": eight of eleven users
finished the job (five satisfied, three partly), and the ones who did not were stopped by specific gaps
(exhaustive long-document work, an unverifiable table, the credits wall) and, around them, the scope rule — not by
answer quality in general. Price explains almost nothing directly — one user mentioned
it, walls arrive before value for 30 of 38 wall-hitters (C‑§7), and the 13 of 19 upgrade clickers who clicked on
the Domain Mode selector were curious about a locked feature while their own jobs were mostly done (T‑4.5). What
price *does* explain is the exit of the two heaviest recent users (§4.1).

## 3. Question 2a — which capabilities to raise, ranked

Ranking rule from the plan: users affected × evidence quality ÷ engineering cost, with the per-answer LLM cost
from T‑4.7 shown so the pricing floor is visible. "Users" counts all eras, then the recent era in brackets.

| # | upgrade | users (E2) | evidence | eng. cost | LLM cost / answer | verdict |
|---|---|---|---|---|---|---|
| 1 | **Citation → verified-quote bridge** — "Save quote" where a citation click lands (strategy §2.1, built on `feat/citation-save-bridge`) | 19 citation clickers, 11 H10 (3 of 3) | mechanism + three post-launch instances | 0 (built; Codex review + deploy) | none | ship in v0.33.0 after 09-28, as planned |
| 2 | **Scope rule: document-first, not document-only** — answer writing and outside-knowledge requests when asked, with the outside part labelled and never cited; keep refusals for genuinely unrelated chat | 14 H8 + 8 outside-knowledge + 7 write-or-draft (5 users in E2) | high — every refusal is in the transcript, three in August | days: prompt policy + terminology contract + tests; Codex (trust-adjacent) | unchanged | first new item; the one change that touches the cohort that pays elsewhere |
| 3 | **Whole-document mode for long files** — user-triggered, per-page map-reduce for "every X", "complete list", "summarise all of it" on documents over ~100 pages; a flat per-document price, per-page pass cached and reused by later questions | 21 coverage turns, 5 users unmet, the payer (E2: 1 user, 3 turns) | high on mechanism; thin on recent count | ~2 weeks; the collection map-reduce and document brief are precedents | $0.063 on a p90 file — ≈ 200 credits if reconciled through the per-token table, hence the flat price (§4.5) | second new item; gate behind a visible "read the whole document" action so cost is chosen, not silent |
| 4 | **Answer integrity fixes** — no mid-sentence truncation on long answers; the comparison misroute's canned English reply; duplicate rapid sends; the demo's catch-all reply that deflects a real pricing question | 7 truncation turns, 4 wrong-language turns (E1/E2), 1 demo case | high, small | days | none | bundle with 2 |
| 5 | **Export where the user asks** — the chat answer should say how to export (it exists, Plus) instead of refusing; consider one free export per document | 7 unmet, 5 turns (E0/E1) | medium | days | none | with the readable-unit copy |
| 6 | Tables and numbers; scanned collections | 5 + 5 users (E2: 2) | thin | weeks | small | defer; revisit with the replay |
| — | Speed, languages, OCR, bigger files, Domain Mode as a paid feature | — | no E2 complaint; cross-lingual met 4:1; OCR exists (3 residual failures); file size fires on people who never chatted | — | — | do not build on this evidence |

Two items already shipped and confirmed by the corpus, for the record: parse failures were a dead end for 7
upload-only users (B2's Retry control, honest error copy and slot rule shipped in v0.30.0, "Batch B first-session
repair", live 09-09); the empty first pane (B1's suggested-questions race, same release) is consistent with 24
one-message users whose first question was generic 8 times and specific 16.

**The replay list** (104 turns, 98 replayable, 38 documents, 34 users; T‑4.5): 68 E0 turns would tell us how much of
May's failure class the current stack already answers, without any new feature; the 19 E2 turns are the honest
test for items 2 and 3. It runs at the service layer inside the production container as the M3 gate did, bills
nothing, and belongs after 09-28.

## 4. Question 2b — pricing, given the findings

### 4.1 What the corpus says about money

- **The free pool is one intense day.** The only user ever to hit the credits wall spent 520 credits in a single
  day on a 160-page ruling — 22 questions, 44 Flash calls, 427k prompt tokens, about 24 credits a question,
  twice the corpus average — returned that evening, met `INSUFFICIENT_CREDITS`, clicked upgrade on the paywall
  modal (offered Plus monthly) and did not buy. A second August user spent 460 of 500 in one day on short fiction
  texts with long analytical answers and simply stopped. Everyone else is far below: 51 of 67 chatters spent
  ≤ 100 credits, 60 ≤ 200 (C‑§6). The pool binds exactly the users who do the most work.
- **Nobody prices the product against an alternative in the transcripts.** 1 of 67 mentioned price; 0 named a
  competitor (T‑4.5). The competition is invisible because it is the general chatbot the user already has — which
  is exactly where the refused "author's life" and "write this for me" questions went.
- **Walls fire before value.** 30 of 38 first walls came before the first message (C‑§7); the file-size wall's
  seven quick exits belong to four users, all events-only, none of whom ever chatted (my cross-tab). The 19 upgrade clickers: 13 clicked
  the Domain Mode selector (8 academic, 5 legal), and their own jobs were mostly done — curiosity, since the feature
  could not be tried before 09-07. None of those users has been back since the trial shipped.
- **Users think in pages** (11 sessions), documents (3), exam items, chapters, file size; credits never (T‑4.5).
- **Cost.** All registered non-owner LLM spend ever is $1.57 (upper bound), $0.022 per active user; the anonymous
  demo cost $0.61; embeddings $0.15 (T‑4.7). A Flash answer earns ten times its cost on Plus.

### 4.2 The value metric

Keep answers as the billed unit (credits reconcile to real cost, which the cost note shows is right), but describe
the allowance in the units users use and with real numbers. A Flash answer reconciles to ≈ 11 credits on average
(285 calls); in the one long-document working day observed it was ≈ 24 per question (44 calls for 22 questions on
a 160-page file) — an example, not a rate. So: **"3 documents · up to 750 pages each · about 45 answers"** for the
signup pool, and **"about 27 answers a month"** for the grant — never "60", and never "per month" for the pool.
`fix/free-credit-copy`'s constant-reading test must read these from `credit_service.py`'s rates, not from the
5-credit pre-debit.

### 4.3 The free tier

Free is de facto a one-time pool: the grant has fired twice in the product's life because signup stamps
`monthly_credits_granted_at` (cost note). Decision: **fix the grant** (one line and a test; it is what the copy,
the pricing page and the FAQ JSON-LD already promise, and a trial dressed as a free plan is the one shape the
pricing research rejected) **and** describe the signup pool honestly as a pool. Do not shrink either. The grant
touches only returners — the cohort with retention — and costs nothing (27 Flash answers ≈ $0.10). The
"activated_free_user" nudge, killed 05-14, produced 72 wall events on 26 users with 42 exits and zero purchases;
nothing in the corpus argues for reviving a nudge.

### 4.4 Packaging by persona

42 of 67 chatters are students, graduate researchers, staff or educators; legal and finance are two users each.
Packaging for professionals is unfounded on this corpus (strategy already parked legal/finance as a second curve).
The paying moments observed are academic and document-shaped: the payer's 492-page exam bank, the 517-page
compilation, the 160-page ruling day, the 254-page novel over twelve days, the five-week monograph quote-mining.
Every one is *one document, worked hard, for days not months*.

**The pass, reshaped.** Read B makes the non-renewing pass the first packaging item after 09-28 (pricing synthesis
§3, §8). The corpus picks its shape: a **7-day document pass** — this document at Plus limits (pages, file size,
sessions, export, Domain Mode, the whole-document mode when it exists) **with its own credit bundle** (order of
1,000 credits: ≈ 90 ordinary answers, or ≈ 40 at the rate seen in the one long-document day), non-renewing,
presented in EUR/CNY so Alipay and WeChat Pay can buy it.
Time-boxed because every heavy user's work fits inside a week; document-scoped because pages are the unit users
name; bundled with credits because the credits wall is the wall the heaviest users actually hit, and today it
offers only Plus monthly. Price stays undecided (§9.3 of the backlog); existence of a first purchase is the metric.

**Where it appears:** every capability wall a free user meets — file size, document count, session count, Domain
Mode, export — **plus the credits wall**, which the pricing synthesis's wall list omitted and which the corpus now
shows is the one deep users reach.

### 4.5 Cost floors for any upgrade

At Plus's $0.00333 per credit, a Flash answer earns $0.037 against $0.0037; Pro for hard question types (32% of
turns) costs $0.0078 and reconciles to ≈ 25 credits ($0.083) — both keep ≥ 80%. Outside-knowledge and writing
answers (item 2) cost the same as any answer. The whole-document mode is the one case where the rate table must
not be applied blindly: the tables' scenario (b) sends 179k input and 7.5k output tokens over ~20 map calls plus
one reduce, which `calculate_cost` (1 credit per 1k input, 3 per 1k output, rounded per call) reconciles to about
200 credits — $0.67 of revenue on $0.063 of cost, but two-fifths of the signup pool for one question. Price it
flat per document instead (order of 50–60 credits ≈ $0.17–0.20 on Plus, ≈ 65–70% margin), run the per-page pass
once and cache its notes so every later exhaustive question on that document costs an ordinary answer. None of the
ranked upgrades needs a plan-price change; all of them need the owner's days.

### 4.6 What changes in the pricing synthesis, and what does not

| item | 20-synthesis | now |
|---|---|---|
| Free stays free and renewing | keep | keep — **but fix the grant so it is true** (§4.3); the pool copy says "pool" |
| readable units | "about 60 questions a month" | "about 45 answers" (pool) / "about 27 a month" (grant); pages and documents lead |
| non-renewing pass | candidate, 7-day vs document undecided | **first packaging item after 09-28 (Read B)**; shape = 7-day document pass with a credit bundle; add the credits wall |
| hard trial on the anonymous surface (§2.3) | keep | keep — 152 of 182 demo sessions end at one message, 5 asked to use their own file; the demo's August/September sessions show two failures in 62 |
| card-first / time-boxed trials, price cuts, removing the grant | rejected | rejected; nothing in the corpus revives them |
| pricing as the lever for return | second-order | second-order for churn; **first-order for the two heaviest recent users**, who left at the pool's edge |

## 5. What would flip these conclusions

- **The replay.** If the 68 E0 replay turns mostly succeed on today's stack, "needs unmet" is historical and item 2
  is the only present-tense capability fix; if the 19 E2 turns fail on the same documents, item 3 rises above 2.
- **A post-T_A registered cohort.** Eleven users is the whole recent sample; ten more August-style users who
  finish and leave would confirm H2; three who stop at the scope rule would confirm item 2's rank.
- **A first pass purchase at the credits or file-size wall** confirms the shape; a completed Plus checkout at any
  wall without a pass says the current walls work and packaging waits (pricing synthesis §5).
- **A user returning to Quote Finder through the bridge** (the `source` on `quote_saved`) confirms item 1 over
  everything below it.

## 6. Decisions and sequencing

**Before 09-28 (no product change; the rule stands):** ratify this synthesis's four amendments to the pricing
record (§4.6); approve the scope-rule change for design (item 2) so Codex can review it with the bridge; approve
the readable-unit rewrite with the corrected numbers; decide whether the monthly-grant fix ships as a correction
with `fix/free-credit-copy` (my recommendation: yes — it is a defect against published copy, not an experiment).

**On 09-28, with the readout:** the default (acquisition: anonymous upload §2.3 + students page) is unchanged and
strengthened; the bridge ships first (v0.33.0, backend-first); items 2 and 4 follow as one Codex-reviewed batch;
the pass is designed (shape here, price and Stripe mechanics after the owner's payment-method check); item 3 is
scoped after the replay.

**Owner-only, unchanged:** Stripe payment methods and pack currencies; the § 356a withdrawal function.

## For the owner conversation

- 我们把 67 位聊过天的用户、93 段对话、182 段匿名演示对话全部读完并逐条编码；三位编码员在唯一付费用户上与五月的判断一致。
- 你的怀疑对一半：二到五月的产品确实没满足需求——答案丢失、找不到页码、大文档只看到几个片段——24 个"需求未满足"的用户里 22 个用的是那个版本。五月底的修复之后，这些失败类型在八月的对话里基本消失了。
- 现在不回头的主因有三个，按大小：从未真正开始用（30 人：传了文档没打开、解析失败、还没提问就撞墙）；一次性把事办完就走了（24 人；你说的"解决完就离开"这一格 16 人里 10 人确实办完了）；需求没满足（24 人，绝大多数是历史版本）。93 段对话里 58 段以一条回答和沉默结束。
- 八月的 11 位用户里 8 位把事办完（5 位满意、3 位部分完成），其余 3 位分别卡在：对大文档做"穷举"类任务（517 页真题集里找出某主题的全部题目）、一张文档里可能根本没有的表格、以及积分墙。围绕这些之外还有一条反复出现的摩擦："只答文档内容"的规则拒绝了学生要的作者生平、歌名、把三份报告合成一个演示——这些问题他们转头就能问通用聊天机器人。
- 系统能力要提的就这几件，按投入产出排：先发已经做好的"引用→保存已验证引文"入口（八月三位要引文/页码的用户都在手动点引用核对、都没碰过 Quote Finder）；把"只答文档"改成"文档优先、外部内容标注"（几天的改动）；给长文档加一个用户主动触发的"通读全文"模式（约两周，每次成本 0.06 美元）；修长回答被截断和一处误路由；导出功能要让聊天里能找到。不需要做速度、语言、OCR、更大文件。
- 成本不是约束：所有非本人用户历史上的模型花费合计 1.57 美元；一次通读 289 页文档 0.06 美元。只有一处要单独定价：按现在的按 token 计费，这一次通读会折成约 200 积分（赠送池的五分之二），所以"通读全文"应按文档收一个固定价（五六十积分左右）并缓存逐页结果。唯一稀缺的是你的开发时间。
- 定价上最重要的发现：免费额度实际是"一个高强度工作日"而不是"一个月"——八月两位最投入的用户各自一天用掉 520 和 460 积分（500 的赠送池），一位撞到积分墙点了升级但面对 9.99 美元月费没买，另一位直接停了。每月 300 的续期因为一个注册时的时间戳几乎从未发放过（历史上只发过两次）。
- 建议：修好每月续期（它本来就写在定价页和 FAQ 里），把额度改用用户自己的单位描述——"3 份文档 · 每份最多 750 页 · 约 45 次回答"（观察到的那一个长文档工作日里只够约 20 次）；不缩减。
- 在每一堵墙（含积分墙）旁边加一个不续费的"7 天单文档通行证"：这份文档按 Plus 上限使用，自带一包积分，支持支付宝/微信的币种。数据支持通行证按"文档 + 天"而不是按"月"来卖：每个重度用户的工作都在一份文档、几天之内完成。价格仍待定，第一笔购买的出现就是指标。
- 09-28 之前不改产品；需要你拍板的：批准上述四条对定价记录的修订；批准"文档优先"规则的设计；每月续期修复是否作为纠错随文案一起发；Stripe 支付方式与积分包币种（只有你能查）。

**Decisions needed (English, for the record):** (1) ratify §4.6; (2) approve item 2 for design and Codex review;
(3) approve the readable-unit rewrite with the corrected numbers; (4) ship the monthly-grant fix as a correction
— yes/no; (5) the pass's shape as §4.4, price after the Stripe check; (6) the replay run after 09-28.
