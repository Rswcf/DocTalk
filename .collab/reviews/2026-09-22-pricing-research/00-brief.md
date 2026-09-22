# Pricing research brief: generous freemium or "a few free tries, then pay"? (2026-09-22)

Written by Claude from the repository and prior records; every number carries its source. Fable 5.1 leads the
research. Other models execute it. The output is a discussion with the owner, not a build: strategy §5 and ruling
4.8 keep caps and pricing untouched before the 09-28 decision day.

## 1. The owner's question (verbatim, 2026-09-22)

> 在修正免费额度之前，请思考一个问题，那就是我们的定价策略到底应该是什么样呢？我们是不应该给他这么多免费额度，这样他完全不用付费呢。我看到很多竞品，他们是直接就给你三次试用，试用完了你就必须得付费。我们也是不是应该采用这样的策略？如果现在的策略，那用户一次性、两次性、三次性，他的这个需求被解决以后，他就会立刻离开，反而我们拿不到用户，是不是这样？独立思考，做一个相关的 research，然后与我讨论。

Paraphrase: DocTalk may be giving away so much that nobody needs to pay. Many competitors give about three
free tries and then require payment. Should DocTalk do the same? Under today's plan, a user's need is met in one
to three uses and they leave, so DocTalk gains nothing from them. The owner wants independent thinking and
research, then a discussion.

## 2. Current packaging (backend `app/core/config.py` on `main`, verified 2026-09-22)

### Plans

| | Free | Plus $9.99/mo | Pro $19.99/mo |
|---|---|---|---|
| Credits | 500 once at signup (`SIGNUP_BONUS_CREDITS`) + 300 per month (`PLAN_FREE_MONTHLY_CREDITS`) | 3,000/mo | 9,000/mo |
| Pro-model answers | 20/mo (`FREE_BALANCED_MONTHLY_LIMIT`) | — | — |
| Documents | 3 | 20 | 999 |
| Open conversations per document | 3 (§9.15: counts open rows; deleting one frees a slot) | unlimited | unlimited |
| File size / pages | 50 MB / 750 | 100 MB / 1,500 | 200 MB / 3,000 |
| Domain Mode (legal/academic) | 1 trial slot | yes | yes |
| Export | no | yes | yes |
| Saved quotes | 30 | unlimited | unlimited |
| Layout translation | 2 × ≤25 pages | ≤150 pages | ≤300 pages |

Annual billing is 20% off.

### Credits

- **How the monthly grant works.** It is lazy and additive: `ensure_monthly_credits` adds 300 on the first chat
  ≥30 days after the last grant (`credit_service.py:287-320`). It never resets and never expires, so only users
  who return accumulate.
- **What a message costs.** A Flash message is estimated at 5 credits and a Pro message at 15
  (`MODE_ESTIMATED_COST`). Actual cost is reconciled later. So month one ≈ 800 credits ≈ 160 Flash messages.
- **Credit packs.** Boost 500/$3.99, Power 2,000/$9.99, Ultra 5,000/$19.99. They are one-time payments any
  signed-in user can buy (`billing.py:868`). They add credits only; they do **not** lift any plan-gated wall
  (documents, conversations per document, file size, Domain Mode, export).

### What happens at a wall, and before signup

- **At a wall.** A free user's upgrade click goes straight to a **monthly Plus subscription** Stripe Checkout
  (`frontend/src/lib/billing.ts` `decidePlanAwareBillingAction`: free → checkout). No one-off purchase unlocks a
  capability wall.
- **Anonymous visitors.** They can only use the 3 demo documents, at 5 messages per (IP, document) per 24 h. Upload
  requires sign-in. Strategy §2.3 proposes an anonymous upload with demo-grade caps, to be decided 09-28.
- **Payment methods.** Checkout sessions do not pin `payment_method_types`, so the Stripe Dashboard decides.
  Whether Alipay/WeChat Pay (zh) or local methods (es markets) are enabled is **unknown — owner check**.
- **Cost of a free user.** Negligible: about $0.07 per active free user per month
  (`.collab/plans/financial-analysis.md`). Plus gross margin ≈ 93% (08-25 review). Cost is not the driver.

## 3. What the data says (owner excluded throughout)

### Funnel, lifetime to 2026-08-25

The funnel, in order (memory `topdown-review-2026-08-25`):

1. 164 signed up.
2. 76 uploaded a document.
3. 62 sent a message.
4. 31 sent ≥3 messages.
5. 27 saw a paywall.
6. 17 clicked an upgrade CTA.
7. 18 reached `/billing`.
8. **0 pressed Subscribe.** This was an architecture defect: nine upgrade entries only redirected to `/billing`.
   A1 fixed it in v0.29.0 on 09-07; entries now go straight to Stripe.

There has been **1 real sale ever**: 2026-05-06, Plus. It was triggered by `file_size`. The buyer's 492-page PDF
then failed in RAG, and they asked for a refund the same day (memory `user-funnel-diagnosis-2026-05-23`).

### Retention

- **Active days over seven months:** 51 users were active 1 day, 8 active 2 days, 3 active 3 days, **0 active
  ≥4 days**. 31 of the 68 who opened a session sent only 1–2 messages.
- **09-22 readout:** 170 signups, 67 ever-active. Day-2 base is 0.149 (10/67). 0 of 67 ever reached a fourth
  active day (`.collab/reviews/2026-09-22-checkpoint-readout/readout-0922.txt`).

### Since T_A (2026-09-07)

- 5 non-owner signups (0.31/day).
- 34 anonymous demo sessions (~2/day).
- 3 uploads.
- **Zero active non-owner users** (control (a) confirmed this is real).
- One non-owner reached Stripe (`checkout_created`), and did not pay. User e8fed11b: a >50 MB file was rejected;
  they clicked upgrade 4.5 minutes later, reached Plus monthly Checkout, and never returned.

### The credit allowance never binds; capability walls do

- There has been 1 `INSUFFICIENT_CREDITS` ever (08-25), and none from non-owners since T_A.
- The walls users actually hit are these:
  - **`file_size`:** the most-hit limit, 12 hits by 8 users up to 08-21. It is also the trigger of the only sale
    and of the only post-A1 checkout.
  - **`session_limit`:** it also fires on demo documents and routes to Stripe (§9.19).
  - **Domain Mode selector:** 11 of 17 upgrade-clickers pre-A3.
  - **Export.**
- **13 pre-T_A returners:** 16 `upgrade_click`, 6 `paywall_opened`, 0 subscriptions. One of them, 040411e1, showed
  three distinct upgrade intents in 113 seconds, all pre-A1, none converted.

### Who retains, and whether they reach Quote Finder

- **The only multi-week retaining cohort ever** is thesis writers who want verbatim quotes with page numbers.
  They are students, so price-sensitive (memory `quote-finder-strategy-2026-06-12`).
- **They verify constantly and never reach Quote Finder:** 75 citation clicks by 13 returners, 0 quote searches
  (§9.14).

### Signups that never start

16 of 19 signups after 05-24 never uploaded (June analysis).

## 4. Prior rulings that bind (do not re-derive; argue with them explicitly if you disagree)

- **§9.3 (backlog-decision):** "Price/value is the wall" needs `checkout_created` ≥ ~5. Not this quarter:
  record, do not decide.
- **§9.4 / 08-25:** no price moves on one data point. The 08-25 review found three things:
  - "don't cut price": nobody ever mentioned price, and margin is 93%;
  - **"Free has no wall" is an unpulled pricing lever;**
  - credits are an unreadable value unit, because competitors sell "2 PDFs/day" or "60 pages/month".
- **§9.15:** the 3-conversations-per-document cap is a depth paywall on the retention hook (users return to the
  same document). Keep it and fix its signage and counting.
- **Strategy §5 / ruling 4.8:** 09-28 is decision day. No change to a product wall (caps, pricing, nudge) on unread
  data. §2.3 (anonymous upload) changes the funnel's unit and must not start before the baseline is recorded.
- **Owner constraints:** code-only, with no manual marketing or outreach. Lifecycle and re-engagement email is
  vetoed.

## 5. Costs a change would carry that are easy to miss

- **Acquisition copy.** Acquisition is SEO-led. The domain has authority ≈6, and a disavow of 188 spam domains
  (uploaded 09-20) has not settled, so rankings are unreadable. About 40 strings in 11 locales state the free
  allowance. Many titles, meta descriptions and FAQ JSON-LD promise "free", "no credit card" or "no signup":
  - the ranking blog post `/blog/free-ai-pdf-chat-no-signup`;
  - the demo pages;
  - the comparison tables that list the free tier as an advantage;
  - the es students title "IA para investigar gratis", just built on `growth/students-academic`.
- **The copy-fix branch.** `fix/free-credit-copy` corrects false "500 credits a month" copy to the true 300. It
  does not change pricing. If the allowance changes, those strings change again; the test reads the backend
  constant.

## 6. The gap only production data can close

The owner's hypothesis is that churned users completed real work inside the free quota. That is **consistent
with** "nobody hits `INSUFFICIENT_CREDITS`", so that fact does not refute it. What discriminates is where each
user stopped:

- **(a)** never started (no upload, no message);
- **(b)** did real work (≥3 messages or a citation click) and left without meeting any wall;
- **(c)** hit a wall.

The companion question is how many users a hard trial of N messages or N documents would have stopped, and
whether before or after first value.

`free_quota_at_churn.py` in this folder computes this. Claude cannot run production reads (auto-mode classifier),
so the owner runs it.

## 7. Research questions

- **(a) Where users leave.** Where do DocTalk users leave relative to the quota and the walls? This is internal,
  from §3 and the owner-run script.
- **(b) What competitors actually do.** Cover at least 8 named products, each with a URL and access date:
  - verify the owner's "about three free tries, then pay" observation tool by tool;
  - include the Chinese-market tools the owner is likely looking at, and es-market options.
- **(c) What the evidence says.** Compare freemium, hard trial or hard paywall, reverse trial, and opt-in or
  opt-out free trial for four cases:
  - (i) a low-traffic, SEO-acquired product;
  - (ii) an episodic, one-off document job;
  - (iii) AI tools;
  - (iv) students.
- **(d) Which question is the real one.** Is it freemium versus trial? Or is it subscription versus one-off
  purchase for episodic users? Today every capability wall leads only to a monthly subscription.
- **(e) What is decidable.** At ~0.3 signups/day and ~2 anonymous demo sessions/day, what can be learned in 4–8
  weeks? Name the experiment, or say honestly "none — decide on reasoning".
- **(f) Cross-constraints:**
  - SEO "free" intent;
  - §2.3 anonymous upload;
  - the 09-28 decision day;
  - EU (the owner is in Germany) consumer-law requirements for trials and auto-renewal;
  - payment methods for zh/es users.

## 8. Deliverable

A recommendation, the strongest argument against it, and the evidence that would flip it. Say where you disagree
with the owner's framing and with Claude's, and why. Not an implementation plan.
