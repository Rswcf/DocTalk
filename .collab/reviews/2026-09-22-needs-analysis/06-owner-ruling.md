# Owner ruling on the needs analysis (2026-09-22)

The owner answered, verbatim: "认可付费方向，文档优先按你的方案来". The ruling is read at face value and not
stretched.

| # | Question (03 §6 / 05) | Ruling | What it does and does not unlock |
|---|---|---|---|
| 1 | Pricing direction (03 §4.6 as amended by 05) | **Ratified.** Free stays free; the allowance is described in readable units; a 7-day single-document pass with its own credit bundle sits beside Plus at every wall, including the credits wall; the trial lives before sign-in (§2.3). | Direction only. **Building the pass is not unlocked.** Its price is undecided (backlog §9.3), the Stripe payment methods and pack currencies are an owner check, and ruling 4.8 means no wall changes before 09-28. §2.3 keeps its 09-28 gate. |
| 2 | Scope rule (03 item 2) | **Claude's opt-in fork chosen.** The user explicitly asks for general knowledge; the assistant does not decide on its own. | A green light to design, not to build. Fable writes the design (`07-scope-rule-design-fable.md`); Claude builds on a branch once it lands. It queues behind the bridge and ships after 09-28. Codex review is mandatory before shipping, because the change is trust-adjacent. |
| 3 | Month one: (a) change the copy, or (b) grant 300 at signup | **Open.** | Default is (a): the copy now reads "500 starter credits, then 300 a month from the second month", staged on `fix/free-credit-copy`. `ensure_monthly_credits` and signup are not touched. |
| 4 | Which competitors the owner saw with "3 free tries" | **Open** (asked twice). | Recorded, not asked again. |

**Held until after 09-28:** the full readable-unit rewrite (~110 keys × 11 locales). It touches the same strings
as ruling 3. Its "≈ 45 answers" is an empirical average (3,195 credits / 285 calls), not a constant. And the pass
will restate Free at every wall. So it is written once, after the grant decision and the pass design.
