# Claude's independent view, before any research came back (2026-09-22)

The owner asked for independent thinking. This was written before Fable's plan or any worker output arrived, so
the synthesis can be checked against it. It rests only on facts in `00-brief.md`.

## 1. The owner's three claims, taken one at a time

**"We give so much free that nobody needs to pay."** Half right.
- The credit allowance is not a wall. There has been one `INSUFFICIENT_CREDITS` ever.
- There is also a detail that makes the claim stronger than it looks. The monthly 300 is granted lazily, on a
  chat at least 30 days after the last grant. Almost nobody comes back (0 of 67 active users ever reached a
  fourth day), so the effective free plan is a one-time ~800 credits at the first chat: about 160 Flash or 53
  Pro answers. "300 a month" is mostly a marketing sentence.
- But capability walls do bind: file size, conversations per document, Domain Mode and export. They produced
  about 17 upgrade clickers and **zero payers**. Until 09-07 every one of those clicks landed on a billing page
  whose Subscribe button nobody ever pressed (the A1 defect). The fair test — walls plus a working checkout —
  has run for 15 days, with zero active users. The current model has not been observed failing; it has not been
  observed at all.

**"Many competitors give about three free tries and then require payment."** To be verified.
- My prior is that the English chat-with-PDF category is mostly freemium with daily caps: ChatPDF,
  AskYourPDF, Humata, and NotebookLM, which is fully free.
- The Chinese market is mostly free, subsidised by big tech (Kimi, 豆包, 通义).
- Hard "N tries then pay" is common in episodic utilities, such as PDF converters and per-document academic
  services. Scribbr sells a plagiarism check per document to students at their deadline. That is the closest
  analogue to DocTalk's retaining cohort.

**"The need is met in one to three uses, they leave, and we get nothing."** The episodic part is very likely
right, and it is the most important point the owner made.
- "Met" is not established. 31 of the 68 users who opened a session sent only one or two messages. That looks
  more like "tried and did not continue" than "finished a real task".
- What decides it is the size of the "real work, no wall" bucket in `free_quota_at_churn.py`.

## 2. My prediction for the script (falsifiable)

- "Never started" plus "uploaded, never chatted" plus "light use, no wall" together: at least 75% of non-owner
  users.
- "Real work, no wall": about 10–20 users over the product's life.
- Credits spent: p90 below ~150, far under the ~800 of month one.

If that holds, most users never reach any version of a wall. How generous the free plan is would then matter
only for the ~10–20% who do real work — which is exactly the group a moment-of-need wall should catch.

## 3. Where I agree with the owner, and where I don't

**I agree** that DocTalk is priced like a habit product (a monthly subscription, and a free plan that renews
monthly), while the job is episodic (read this contract, find quotes for this thesis chapter). For an episodic
job:
- a renewing free plan is worth nothing to us, because nobody returns to use it;
- a monthly subscription is the wrong thing to ask for at the moment of need.

The single sale ever came from `file_size`, a moment of need. The only checkout since the fix came from the same
wall and did not pay; that user was asked for a monthly subscription to process one file.

**I disagree** that "three free tries" is the right answer. There are four reasons:
1. **Value arrives late.** DocTalk's value is verification: a cited answer, then clicking through to the
   passage. That shows after several answers, not one. The owner's own retaining cohort, thesis writers, clicked
   citations 75 times across 13 returners before any of them would have paid.
2. **Pricing is not the binding constraint now.** 16 of 19 signups never uploaded, and zero non-owner users
   have been active since 09-07. A paywall does nothing for people who never start.
3. **"Free" is the acquisition hook of an SEO-only product with authority ≈6.** Rewriting it has a real cost.
4. **The market is free.** NotebookLM is free, and the zh assistants are free. A hard trial sends a user who
   has not yet seen the differentiator to a free alternative.

## 4. What I would recommend, subject to the script

1. **Keep a free entry; make it a one-time trial, not a monthly plan.** Remove the monthly 300 top-up and keep
   a clear first allowance in units people understand: documents and questions, not credits. The 08-25 review
   already found credits unreadable. The removal costs almost nothing, because almost nobody receives it.
2. **Put a one-off purchase at the moment-of-need walls** beside the subscription: a 7-day pass that unlocks
   Plus capabilities and does not auto-renew. Today credit packs add credits but lift no wall, so an episodic
   user at a wall can only subscribe. A non-renewing pass also avoids EU auto-renewal and trial obligations.
3. **Keep the anonymous demo** as the "no signup" promise. Reword "free" copy to "free to try". The
   `fix/free-credit-copy` branch stays correct either way: it states whatever the backend grants, and its test
   reads the constant.
4. **Timing.** Decide on or after 09-28, with `free_quota_at_churn.py` in hand. Ship nothing before it
   (ruling 4.8).
5. **What counts as learning.** With about 9 signups a month nothing is statistically decidable. The signal
   we lack is existence: does anyone pay at a moment-of-need wall when offered a one-off option? The first
   payment is informative. §9.3's "C ≥ 5" is about price level, not about whether a packaging change produces
   any payment at all.

## 5. What would change my mind

- **The script shows "real work, no wall" as a large group** (for example, 30% or more of users who chatted,
  with p75 spend above 300). Then the free allowance really is feeding completed jobs, and a hard trial,
  closer to the owner's proposal, becomes the better bet.
- **Research shows the category has moved to hard trials** and that such tools still rank for "free" queries.
  Then the acquisition cost of tightening is lower than I assume.
- **The first post-A1 wall-to-Stripe checkouts start completing without any change.** Then the current walls
  work and the packaging question can wait.
