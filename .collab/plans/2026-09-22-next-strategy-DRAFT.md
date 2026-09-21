# DocTalk — what to push next (Fable 5.1, DRAFT, unfinished)

**Status.** On 2026-09-22 the owner asked Fable to work out the strategic next steps. Fable read the
evidence (memory files, `.collab/` plans and reviews, code) and wrote the outline below, then its
session hit the Fable usage limit (HTTP 429) before it could write the full plan. The outline is
Fable's own text, captured verbatim from its last message. Nothing in it has been expanded or
reworded. Fable should finish the plan when its quota resets. Claude's fact checks are in a separate
section at the end.

---

## Fable's outline (verbatim)

**Diagnosis.** The constraint is compound and I'll name it as such: (a) learning is starved — ≈0.5 signups/day → ≈0.2 newly-active users/day, so every pre-registered wall metric is an existence read and day-2 is undecidable before Feb 2027 (§9.13); the walls that were measurably broken are fixed since 09-07/09-09, but whether they convert is *unread* because the pre-registered 09-21 checkpoint was never run (no record anywhere; `observation_window.py` also lacks the §9.8/9.11/9.15/9.18 amendments — day-2 still anchors on `users.created_at`). (b) The one cohort that has ever retained — source-verifiers/thesis writers (19 users, 163 citation clicks, 0/19 ever reached Quote Finder; the 06-12 cohort) — has no in-product path to the differentiator and no marketing page (no `use-cases/researchers`; the only ranking cluster is the academic blog post at #62–93; the lowest-KD terms in the whole corpus are zh/es academic and the locale pages exist).

**Ranked initiatives.** (0) Run the overdue checkpoint readout now, with the specified amendments, and hold 09-28 as the decision date with its default. (1) Citation-popover → verified-quote bridge (one action on the popover: save the supporting sentence as a server-verified quote; fallback opens the panel prefilled, never auto-submits) — frontend-only, ~2 Claude-days. (2) `use-cases/researchers` ×11 targeting the zh/es academic long-tail + internal links from the ranking post — ~2 days; deliberately NOT `unlimited uploads` (we aren't) or category-head terms. (3) Anonymous upload with demo-grade caps (2/IP/24h, 20 MB, 100 pages, 5 msgs, Flash, 24h TTL, sign-in-to-keep) — ~6 days, start only after the 09-28 readout unless it produces an outranking thread; category norm (ChatPDF is no-account). (4) Ship v0.32.1 (Fraunces preload + Phase 2b option-B titles, already committed at `899298e`) after a BLOCK-only Codex pass on 09-23.

**Stop.** Design Phases 3–5 (A2 retired), Phase 2b hub/headline rewrites, Jev title work (gated on a GSC export that doesn't exist), Quote Finder M4/exports, dormant features, pricing changes (frozen until ≥5 `checkout_created`), share-page loop (2 shares ever).

**Owner decisions.** Anonymous upload go/stage/no; one-time directory listings (only earned-link path at AS 6, conflicts with "code only"); web-filter categorization (deferred twice — asked once more, not nagged); GSC exports + Domain property; Railway token; ratify the 09-28 default.

**First slice.** The readout (≤1 day, read-only, acceptance criteria per row); slice 2 (the popover bridge) can start in parallel since it doesn't depend on it, with T_popover recorded.

---

## Claude's fact checks (2026-09-22, read-only; code and docs only, no production data)

- **Checkpoint: confirmed.** `.collab/plans/2026-09-03-backlog-decision.md` §8.6 and §9 set 2026-09-21 as a checkpoint ("Run the readout; act on defect triggers; record first reads") and 2026-09-28 as the decision date (T_A + 21 d). No readout record dated 2026-09-21 or later exists under `.collab/reviews/`; the 09-21 entries are the design and SEO reviews. That matches "never run".
- **`observation_window.py`: consistent.** `backend/scripts/observation_window.py` counts signups by `users.created_at >= T_A` (line 67), while §9.11 amends the day-2 decider to users whose first *active* day is ≥ T_A. Checked at that level only, not line by line against every amendment.
- **Researchers page: confirmed missing.** The `use-cases/` routes are compliance, consultants, finance, healthcare, hr-contracts, lawyers, real-estate, students and teachers; there is no researchers page.
- **Shipping precedent.** The same plan's §9 row 3 shipped a frontend-only marketing branch "as a separate `git push origin stable` with no version bump".
- **Not verified here (needs production data or the sources Fable cited).** 19 source-verifier users, 163 citation clicks, 0/19 reaching Quote Finder, ≈0.5 signups/day, the blog post's #62–93 ranking, keyword difficulty.
