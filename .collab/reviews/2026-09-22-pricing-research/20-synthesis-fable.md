# Pricing research — synthesis (Fable 5.1, 2026-09-22, step 2 of 2)

> **Erratum (Claude, 2026-09-22, after re-reading chatdoc.com):** ChatDOC Free's page limit per file is **300**, not 3 — "3 Pages/File" belongs to another row of its table. Every "3 pages per file" below (§1 items 1–2, §6, the first owner bullet) is wrong; ChatDOC's lifetime caps (10 files, 100 questions) and DocTalk's per-document lead (750 vs 300/150/120/100 pages) stand. See `04-claude-after-synthesis.md`, which also records Claude's concession and one dissent.

Inputs: `00-brief.md`, `01-plan-fable.md` (my prior), `02-claude-independent-view.md`, `03-repo-answers-claude.md`,
the four worker reports `10`–`13`, and the amended `free_quota_at_churn.py`. Rows are cited by the worker files'
own numbering (T1 = `10-competitors-en.md`, T2 = `11-…zh-es.md`, T3 = `12-evidence.md`, T4 = `13-constraints.md`).
**The script has not been run.** Section 3 keys the recommendation to its cells, so the owner can read the
verdict off the output the day it runs. Nothing here changes a cap, a price or a nudge before 09-28 (strategy §5,
ruling 4.8). This is a recommendation on the *shape* of Free and of the wall, not an implementation plan.

## 1. What the research found — the load-bearing facts

1. **"About three free tries, then pay" is not what the category does.** Of 15 English-market tools, 2 have a
   lifetime cap — ChatDOC (10 files ever, 3 pages per file on the live table; 100 questions ever) and PDF.ai
   (1 PDF ever) — and both are demos dressed as plans, not tools anyone works in. 12 of 15 have no lifetime cap —
   rolling allowances, per-file gates or an unlimited core; Adobe has no free AI at all, only a 7-day trial;
   Scholarcy is ambiguous (T1 headline, rows 2, 5, 8, 10, 12, 13). Of the
   10 Chinese-market rows, the general chatbots (Kimi, 豆包, 千问, DeepSeek, 元宝, 文心) publish no counter and
   sell stronger models or capacity; the one literal "N, then never" case is PopAI (500 credits, ~50 documents,
   ~150 chats, lifetime) (T2 rows 1–6, 10). Nobody found "three".
2. **The category's units are documents, pages and questions, never credits** — 2 documents/day (ChatPDF),
   1 document + 50 questions/day (AskYourPDF), 60 pages/month (Humata), 600 pages + 50 questions/month
   (Docalysis), 120 pages per upload (Anara) (T1 rows 1, 3, 4, 7, 8). Measured in those units, DocTalk Free is
   the **most generous per document where a per-file cap is published** (750 pages / 50 MB against 3, 100, 120,
   150 pages) and among
   the **least generous in document count** (3 kept, ever) (T1 last column, every row).
3. **One-off purchases exist in the category and dominate the Chinese market's paid surface.** ChatDOC sells file
   and page packages ($0.29/file, $0.06/page, valid 90 days); Humata and Consensus sell overage; Paperpal sells a
   multi-year prepay marked "No auto-renewal" (T1 rows 2, 4, 14, 15). 文心's entire purchase list is one-off
   top-ups (¥1–¥500); 秘塔 sells knowledge-base credit packs from ¥3.50; 豆包 and 千问 sell creation-credit packs
   beside memberships (T2 rows 2, 3, 6, 7). No consumer day pass was found anywhere.
4. **No Chinese wallet can pay DocTalk a subscription today; whether one can buy a pack is unverified.** Alipay,
   WeChat Pay, Bizum and OXXO are one-time only in Stripe Checkout — excluded from subscription mode — and a German
   account presents them in EUR or CNY, never USD; `billing.py:791-796` fails closed on any non-USD subscription
   price (T4 §C, note 2). Even with Adaptive Pricing, cross-border *subscriptions* are cards only (T4 §C note 3).
   Whether the existing packs are payable by those wallets turns on two facts nobody could read: the packs' Price
   currency and the methods enabled in the Dashboard (T4 gaps 8–9). A one-off unit presented in EUR/CNY is
   therefore not a packaging preference for zh users; it is the only possible path.
5. **The one randomized study of the owner's mechanism says the remedy is a purchasable unit at the moment of the
   job, not a smaller allowance.** In a 680,588-user RCT inside a freemium SaaS, users who completed many premium
   tasks during the trial converted *less* at trial end (demand saturation), and 41% of all conversions came
   later, after promotions (T3 row 30). DocTalk cannot send promotions (owner veto). Half of app conversions
   happen on install day; 89% of trial starts happen in the first session (T3 rows 4, 14). The decision window is
   the first sitting.
6. **Per visitor — the unit an SEO-acquired site controls — free models rank: usable-before-signup 5.6 payers per
   1,000 visitors > freemium 5.0 > no-card trial 3.6; card-required trial 10.5 but on 35 signups instead of 90**
   (T3 row 18, self-reported B2B). The mobile figure the owner will meet — hard paywall 10.7% vs freemium 2.1% —
   is measured on *installs*, i.e. already-acquired users paying before use, and retention after purchase is
   identical under both (T3 rows 1, 2).
7. **The rest of the constraint picture.** On T4's reading of the texts, a non-renewing one-off purchase carries
   the fewest obligations (order button + the withdrawal consent/acknowledgement; § 312k, § 309 Nr. 9 and the
   card-network recurring rules address recurring contracts) — whether a pack is digital content (§ 356 Abs. 6)
   or a service (Abs. 5) is unresolved (T4 A1, A6, A7, A9, A10, B1, B4, gap 6). Trials that convert carry the
   most: Sofatutor (one withdrawal right, on
   clear disclosure), Visa/Mastercard pre-charge reminders (T4 A12, B1, B5). Stripe can send that reminder itself
   (T4 B9) — so the e-mail veto is *not* what rules trials out; see §2.4. "Free" is the category's promise in
   en and es search (4/5 and 5/5 top titles; es autocomplete asks for "sin registro", "sin límites"); zh academic
   reading intent (读论文 ai) carries no 免费 at all (T4 §D). And § 356a's withdrawal function (in force
   2026-06-19) is absent from the product — a verified compliance gap on the *existing* paid plans (T4 A11).
8. **Inside DocTalk.** No wall a free user meets offers anything but a monthly Plus Checkout; packs live on
   `/billing` and lift no wall (repo #1). No "free"-modified query ranks and the only organic traffic is
   `/features/free-demo`, so the "free" copy carries future rankings and on-page conversion, not current traffic
   (repo #5). A trial-only Free would falsify ~110 keys × 11 locales; ~130 "free demo / no signup" keys survive as
   long as the demo stays (repo #2).

## 2. Recommendation — the shape of Free and of the wall

**2.1 Free stays free and renewing; re-denominate it, do not shrink it.** Keep a signed-in free plan that renews.
Describe it in the category's units — "3 documents · up to 750 pages each · about 60 questions a month" — instead
of credits (08-25's "unreadable unit" finding, now measured against 15 tools). That is copy, not a cap change, and
`fix/free-credit-copy`'s constant-reading test keeps it honest. No hard trial on the signed-in surface: it would
fire before value for most users (mechanism, §1 item 5), place DocTalk with the two demo-grade tools in the audit,
and rewrite the "free plan" promise the category makes.

**2.2 One non-renewing purchase beside Plus at every capability wall a free user hits.** Today `file_size`,
the document cap, Domain Mode, export and the Pro-answer cap all lead to one thing: a $9.99/month subscription.
The only sale ever was episodic and refunded the same day; the only post-A1 checkout was offered `plus/monthly`
and left. Add one one-off SKU that lifts the wall the user is standing at and does not renew. Two shapes, decided
after the script (§3): a **7-day Plus pass** (one SKU lifts every wall; matches a first-to-last span under a week)
or a **document pass** (this file, at Plus limits — ChatDOC's shape). It must be presented in a currency Alipay
and WeChat Pay accept (EUR or CNY), which the subscription code cannot do and a `mode=payment` session can
(§1 item 4; pack-path currency guard unverified). Price is not decided here — §9.3 stands.

**2.3 The hard trial lives on the anonymous surface.** Strategy §2.3 (one anonymous upload with demo caps: a
few messages, one document, sign in to keep it) *is* "a few free tries, then commit", placed where the audit's
no-account tools put it (ChatPDF, Smallpdf) and where the per-visitor evidence puts the best free model
(§1 item 6). This research strengthens §2.3's case; it does not change its 09-28 gate.

**2.4 What is not recommended, and why.**
- *"Three tries, then pay" on Free* — §2.1. Also: 25 of 107 documents were never opened and 31 of 68
  session-openers stopped at 1–2 messages; a wall at message 4 converts the unactivated.
- *Card-upfront or time-boxed trials, reverse trials.* Correction to my prior: the e-mail veto is not the blocker,
  because Stripe sends the pre-charge reminder (T4 B9). The blockers are that 0 of 67 users were ever present on
  day 4 (nobody is there when a trial ends), a card wall cuts signups by ~60% (T3 row 18), and a solo operator
  takes on the refund and withdrawal exposure of converting trials (T4 A12, B1, B5). A reverse trial also removes
  the capability walls that produce the only intent signal DocTalk has; ChartMogul could not distinguish its
  conversion from the others (T3 row 17).
- *Removing the monthly grant* (Claude's 02 §4.1) — §6.
- *Price cuts or a student tier now* — nobody has mentioned price; §9.4 stands; no source measures student
  conversion (T3 gap 8).

## 3. Conditional on the script — the verdict by cell

The owner runs `free_quota_at_churn.py` once (owner-actions §4). Read the sections in this order.

| Read | Sections and cells | Threshold | What it changes |
|---|---|---|---|
| **A. Never-activated dominates** | §1a/§1b: `never started` + `uploaded, never chatted` + `light use, no wall`; §9: "never cited" cells; §6: p90 spend | bottom three buckets ≥ ~75%; "never cited" the largest real-work cells; p90 < ~150 | Pricing is not the lever. Free unchanged; the pass stays a cheap missing option ranked **below** §2.3 and the bridge; a hard trial is rejected outright — §4 at N = 3 will show it stopping mostly never-cited users. This is Claude's 02 §2 prediction; credit it if it lands. |
| **B. Solved and left** | §9: `own document · cited · span < 1 day`; §6: spend > 300; §12: "one job, done" | that cell is the largest real-work cell; several users > 300; one-and-done a sizeable share of chatters | The owner's usage claim is confirmed. The pass becomes the **first** packaging item after 09-28. Tighten the document *count* only if §5/§8a show users with ≥ 2 own documents — still renewing, still free, denominated in documents. Not "three tries". |
| **C. Walls stop people** | §7: "stopped at the first wall (0 later messages)"; "first wall after first citation click" | both dominant among wall-hitters | The pass is exactly the missing option at a moment of proven value; highest confidence for 2.2. |
| **C′. Walls are soft** | §7: "kept going after the first wall" dominant | — | Users route around walls; fix the wall's unit and signage before adding a price to it; the pass waits. |
| Modifier — length | §8b: active after day 7 / day 14; §3 spans | ≈ 0 after day 7 | 7-day pass, not 30; time-boxed trials confirmed dead. Activity after day 7 > a handful → consider a 30-day non-renewing pass and keep the monthly grant (those users receive it). |
| Modifier — contents | §10: `PRO_MODE_LIMIT_REACHED` users; `upload_limit: 3-document cap` users | > 0 | Pro cap fired → the pass includes Pro answers. Document cap fired (§9.14 says 6) → documents lead the readable unit and the document pass gains ground. |
| Modifier — shape | §11: page p50/p90 of real-work users' documents; first document > 100 pages | p50 > 100 | The value is per-document depth → document pass. Small documents → 7-day pass. |

Under **A** the whole packaging question is second-order and the 09-28 default (acquisition, §2.3) is unchanged.
Under **B** or **C** the pass joins the 09-28 list as the packaging item. Under **C′** it waits.

## 4. The strongest argument against, and the answer

*Activation is the constraint, not pricing: 16 of 19 signups never uploaded, zero non-owner users have been active
since T_A, and this touches only the 10–20% who ever reach a wall.* — Correct, and it is why the recommendation is
a **missing option, not a growth bet**: cheap, self-contained, and the only Stripe rail on which a Chinese wallet
can pay at all. Its metric is existence (a first one-off purchase), not a rate. Under Read A it ranks below §2.3
and the bridge, and the file says so. A second argument — the pass cannibalizes Plus — has nothing to cannibalize
(0 subscribers), and low-priced AI subscriptions keep 23% of revenue after a year anyway (T3 row 21): a pass
captures the same money without the month-two churn and the refund.

## 5. What would flip it

- The script cells in §3: Read A demotes the pass; Read C′ delays it; Read B with multi-document sittings adds a
  document-count tightening. Nothing in the script produces "three tries".
- A first Plus checkout **completing** at a wall without a pass — then the current walls work and packaging waits.
- Externally, nothing found flips it: the category did not move to hard caps (three distinct tools across both
  audits, ChatDOC appearing in both), and no source
  compares a one-off with a subscription at the same wall (T3 gap 12) — that comparison, if it is ever read, is
  DocTalk's own existence event.

## 6. Where I disagree

**With the owner's framing.** (1) "Competitors give three tries" — three distinct tools across both audits
(ChatDOC appears in both), and where the lifetime cap exists the free tier is a demo (3 pages per file; 1 PDF
ever). DocTalk already has a demo. (2) "They
solve their need and leave" — the *episodic* half is probably right and §3 measures it; the *solved* half is
unmeasured and the funnel points the other way (1–2 messages, unopened documents). Where the job *is* solved
inside the free allowance, the RCT says the answer is a purchasable unit at the moment of the job, not a smaller
allowance that fires before value. (3) "We give too much" — the wrong *unit*, not the wrong amount: per document
DocTalk is the most generous tool in the audit among those that publish a per-file cap, and in document count one
of the least; nobody has hit the credit allowance in seven months.

**With Claude's independent view (02).** Agree on the non-renewing pass at the walls (his §4.2 — sharpened here:
for zh it is the only payable path), on keeping the demo, on timing and on existence as the metric. **Disagree on
removing the monthly grant** (his §4.1): it has zero revenue upside (nobody hits credits), it rewrites 47
allowance keys × 11 locales including FAQ JSON-LD, it lands only on the returning cohort — the one cohort with
retention, who are the only users who ever receive month two — and it would make DocTalk one of the two
lifetime-cap tools in the audit. Conceded: "300 a month that accumulates and never expires" is more generous than
the copy says; a reset-not-accumulate grant is hygiene for a later batch, not a lever. Disagree mildly on
rewording "free" to "free to try": if the plan stays free the copy stays true.

**With the brief.** Its (c) treated opt-out and reverse trials as live options; on constraints they are not
(§2.4). Its §5 called `/blog/free-ai-pdf-chat-no-signup` the ranking post; repo #5 withdrew that.

## 7. Rulings after the research

§9.3 keep (price level undecidable; packaging shape decided on reasoning + this evidence). §9.4 keep. 08-25 "Free
has no wall" amended to "no *credit* wall; capability walls fire and carry the lever". "Credits unreadable"
confirmed against 15 tools. §9.15 keep. Strategy §5 / 4.8 keep — the pass is a 09-28 candidate, not a change.
§2.3 keep, reframed as the trial. Owner constraints keep. My prior's e-mail argument is corrected (§2.4); its SEO
argument is restated (future rankings and on-page conversion, not current traffic).

## 8. The 09-28 candidate, the decision, and the owner-only checks

> **Ratified by the owner, 2026-09-22** ("认可付费方向"), as amended by `../2026-09-22-needs-analysis/03-synthesis-fable.md` §4.6 and its `05`. The ruling is recorded in `../2026-09-22-needs-analysis/06-owner-ruling.md`. The pass itself is still unbuilt and unpriced.

**Candidate item (post-09-28, shape only):** one non-renewing SKU beside Plus at every capability wall a free user
hits, in EUR/CNY-capable presentment, with `checkout_created reason=<pass>` and a first-purchase existence read;
plus the readable-unit copy for Free. Sequenced by §3: first packaging item under B/C, below §2.3 and the bridge
under A, waiting under C′. Design (7-day vs document pass, price, plan-override mechanics) after 09-28, Codex
review, backend-first.

**The one decision.** Ratify the direction — *Free stays free and renewing in readable units; the trial lives
before sign-in (§2.3); a non-renewing pass beside Plus is the post-09-28 packaging candidate* — **or** choose a
trial-only Free. Everything else follows from the script.

**Owner-only, needed before the pass can be designed:** which payment methods are enabled in the Stripe
Dashboard; the currency of the three pack Prices; whether Adaptive Pricing is on (T4 gaps 8–9). **Owner-only,
independent of this decision:** the § 356a withdrawal function is absent (T4 A11) — a verified gap on the existing
paid plans; read with counsel, not solved here.

**Side items for Claude, one line each:** the compare/alternatives pages still say NotebookLM (renamed Gemini
Notebook 2026-07-16, T1 row 11); the readable-unit copy must be written with `fix/free-credit-copy`'s
constant-reading test in mind (repo #3). Also for the record: zh academic intent carries no 免费 while es carries
it everywhere (T4 §D) — different cohorts, different levers; and the es SERP was never geolocated (T2 gaps).

## For the owner conversation

- **What we found.** Fifteen English tools, ten Chinese, six Spanish-market: only two English and one Chinese tool
  literally give a fixed number of free uses and then stop — and those free tiers are demos (3 pages per file;
  one PDF ever). The rest give a rolling free allowance every day or month, counted in documents, pages or
  questions. Among the tools that publish a per-file limit, DocTalk's free plan is the most generous per document
  and among the least generous in how many documents you can keep.
- **The number you will see quoted — "hard paywalls convert 10.7%, freemium 2.1%" — is about app installs paying
  before use, not about free tries.** Counted per website visitor, which is what an SEO-acquired site controls,
  the free models come out ahead of no-card trials, and a card-first trial wins only by losing 60% of signups.
- **The real gap is not how much is free; it is that every wall offers one thing — a $9.99 monthly subscription.**
  Our only sale ever was a one-off need and was refunded the same day; the only checkout since the fix was offered
  a monthly plan and left. And a Chinese user cannot subscribe today: Alipay and WeChat Pay only work for
  one-time payments, in EUR or CNY, and our subscription code only accepts USD — whether they could buy a credit
  pack depends on two Stripe settings only you can check.
- **What we recommend.** Keep Free free and renewing, but describe it in documents, pages and questions instead of
  credits. Put one non-renewing pass — a 7-day pass or a per-document pass, decided after the data — beside the
  subscription at every wall, payable by Alipay/WeChat. Put the "few free tries" on the anonymous surface: one
  upload, a few messages, sign in to keep it (the anonymous-upload item already on the 09-28 list).
- **What we are not recommending.** "Three tries then pay" on the signed-in plan: most users leave after one or
  two messages, before they have seen a citation; a wall there converts nobody and rewrites about 1,200 marketing
  strings. Card-first or time-boxed trials: nobody has ever been present on day four, so nobody is there when a
  trial ends, and a solo operator in Germany carries the refund and withdrawal obligations. Removing the monthly
  grant: it changes nothing for the users who leave and only touches the ones who come back.
- **What the data must still tell us.** The script you have not yet run says whether users leave *before* value
  (then pricing is not the lever and this is a small, cheap fix) or *after* finishing a job (then the pass is the
  first packaging item). Either way the answer is not a smaller free plan.
- **Two things only you can check:** which payment methods are switched on in Stripe, and the currency of the
  credit packs. And one compliance item found on the way, unrelated to this decision: German law has required an
  online "withdraw from contract" function since June 2026, and the product does not have one.
- **The one decision.** Ratify the direction — Free stays free, the trial moves before sign-in, a non-renewing pass
  beside Plus is the candidate for after 09-28 — or choose a trial-only Free instead.
