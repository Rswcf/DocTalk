# Claude after the synthesis: checks, one design fork, one correction (2026-09-22)

**Checked against the coded data and the code, and they hold:**
- *The eleven August own-document users.* 5 satisfied, 3 partly done, 2 gave up, 1 stopped by a wall. So 8 of 11
  finished, as the synthesis says.
- *The two heaviest users.* The first spent 520 credits in 22 messages on one day, on a 160-page document: 44
  calls, 427k prompt tokens, two `INSUFFICIENT_CREDITS` walls, two upgrade clicks. The second spent 460 in 11
  messages on one day, on ≤5-page texts, and hit the 3-document cap twice.
- *The whole-document cost.* `deepseek-v4-flash` reconciles at 1 credit per 1k input tokens and 3 per 1k output
  tokens (`CREDIT_RATES`). So 179k in / 7.5k out comes to about 200 credits, as the synthesis says.
- *Privacy.* The synthesis and the tables contain no copied 9-word window of any message.

**Agreed:**
- the era verdict;
- the capability ranking (bridge, scope rule, whole-document mode, integrity fixes, export discoverability);
- the 7-day document pass with its own credit bundle, including at the credits wall;
- readable units with real numbers.

**Fork on item 2 (the scope rule): who decides to go beyond the document.** The synthesis has the assistant
answer writing and outside-knowledge requests itself, labelled and never cited. I would make it **the user's
explicit choice**: after an "that isn't in the document" answer, an action such as "Also answer from general
knowledge", or a per-question toggle. Four reasons:
1. The product's one guarantee is that answers are grounded and cited, and the routing is deliberately
   deterministic-safe (`rules/backend.md`). An automatic blend makes it ambiguous which sentences are verified.
   It also lets the model fill gaps silently, which is the failure the citations exist to prevent.
2. With opt-in, the default answer stays verifiable.
3. Each opt-in click is a measurable demand signal.
4. The cost is one click for the students who wanted an author's life or a song's name.

Both designs need Codex review. The owner picks the fork before the design starts.

**Correction to "the monthly grant has fired twice, so renewing is not true."** The renewal does work. A free
user who chats 30 or more days after signup gets 300 (`ensure_monthly_credits`). It fired twice because almost
nobody returns after 30 days. The real mismatch is **month one**: the pricing page promises "300 credits every
month + 500 starter credits", i.e. 800, and a new user gets 500. There are two honest fixes:
- **(a) Copy now:** "500 starter credits, then 300 each month from your second month." This touches no wall, so it
  is consistent with ruling 4.8.
- **(b) Behaviour:** grant the first 300 at signup.

(b) is not a neutral correction. It moves the credits wall later for exactly the heavy one-day users, who are the
people the pass is meant to catch. My recommendation: (a) now, with `fix/free-credit-copy`; decide (b) after
09-28, together with the pass.

**A gap in the corpus.** W3 found five users with chat credits spent and no sessions in the export. `delete_session`
is a hard delete (§9.15), so their spend counts but their conversations are gone. "Real work" is slightly
undercounted.
