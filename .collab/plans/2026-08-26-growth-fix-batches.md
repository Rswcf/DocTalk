# Growth fix batches — 2026-08-26

Source: top-down growth review 2026-08-25/26 (fresh prod pull + live Stripe read + 6 parallel code audits).
Report: https://claude.ai/code/artifact/7c395753-2062-41ef-b085-5a11cf7d64f4
Memory: `topdown-review-2026-08-25`

**Every code-level claim below was read at source by Claude before this plan was written.** Two findings
from the audit subagents were REJECTED during that verification and are recorded in §0 so nobody
re-adds them.

## 0. Rejected findings — do NOT implement these

1. **"Abandoned Stripe checkout permanently locks the user out."** FALSE.
   `backend/app/api/billing.py:107` defines `PENDING_SUBSCRIPTION_TTL = timedelta(minutes=10)`, and
   `_recover_pending_subscription` (`:163-198`) first reconciles against Stripe (adopting a real
   subscription if one exists) and otherwise clears the sentinel once stale. Worst case is a 409
   "checkout already in progress" for ≤10 minutes. Optional P2 polish only (reconcile the Checkout
   Session status so an explicitly abandoned session clears at once). **Not a blocker, not in these batches.**
2. **"The document-brief pipeline renders to nobody."** OVERSTATED. Production: 37 of 93 ready user
   documents carry `suggested_questions` + `summary`; 40 briefs exist. The real defect is the
   first-visit race in §B1 — narrower, and the fix is different.

## 0.1 Ground truth the batches are aimed at (owner excluded)

- 164 signups, 0 paying, 0 active subscriptions.
- Retention: 51 users active exactly 1 day, 8 on 2, 3 on 3, **0 on 4+**. 25 of 107 docs never opened.
- `upgrade_click` with `metadata_json->>'path' = '/billing'`: **zero rows, ever.** 24 billing-page
  arrivals by 16 users since 9 May. Live Stripe holds 5 sessions / 4 customers total, newest 6–7 May.
- `domain_mode_selector` = 11 of the 17 users who ever clicked upgrade. `sessions.domain_mode` is
  NULL on all 263 sessions.
- Only real conversion ever (2026-05-06, Plus) came from `source=limit, reason=file_size`.
- Quote Finder: 0 searches and 0 saved quotes by any real user.

---

## Batch A — Revenue unblock (billing-sensitive; MUST go through Codex adversarial review)

### A1. Make the intent click the purchase click

**Problem.** Nine upgrade entry points all fire an analytics event then `router.push`/`<Link>` to
`/billing`. The only code path that creates a Stripe Checkout Session is the Plus/Pro button inside
`BillingPageClient` (`:764-771` Plus, `:833-841` Pro → `handlePlanAction:280` → `handleSubscribe:227`
→ `createSubscription`, `frontend/src/lib/api.ts:519-525`), which sits below the hero, the
billing-overview aside and the period toggle. Nobody has ever pressed it.

**Change.**
- Extract `startCheckout({ plan, billing, source, reason })` into `frontend/src/lib/billing.ts`
  (new): POSTs via the existing `createSubscription`, then `window.location.href = res.checkout_url`.
  It must surface failures — see A2.
- Wire it directly into the in-app intent buttons so the click that expresses intent opens Stripe:
  - `src/components/Chat/DomainModeSelector.tsx:33-39`
  - `src/components/PaywallModal.tsx:151-153`
  - `src/components/Chat/ChatPanel.tsx:330, 651` (plus-menu: export_pdf, custom_instructions)
  - `src/components/dashboard/DashboardPageClient.tsx:410, 462, 501`
  - `src/components/SessionDropdown.tsx:257`, `src/components/Profile/CreditsSection.tsx:72`,
    `src/app/collections/[collectionId]/page.tsx:545`, `src/components/ModeSelector.tsx:23`
- Anonymous users have no session to charge: keep the existing navigation for them (they must sign in
  first). Gate on the same auth check those components already use.
- Where a hop to `/billing` must remain (pricing page, anonymous), make `/billing` self-closing: when
  `?plan=` and `?source=` are present, render a **sticky top offer bar** with a single CTA bound to
  `handleSubscribe(plan)`, so no scrolling is required. Reuse existing i18n keys (`billing.upgrade`,
  `billing.plus.title`, `billing.perMonth`) — present in all 11 locales.

**Do not** change `upgrade_click`'s position relative to `createSubscription`: it currently fires
unconditionally on the line before the call (`BillingPageClient.tsx:233` → `:239`, no gate), which is
exactly what made "zero events = zero clicks" provable. Preserve that property in `startCheckout`.

### A2. Make checkout failure visible

`handleSubscribe`'s catch is a bare `setMessage(t("billing.error"))` (`BillingPageClient.tsx:244-247`),
discarding the backend's real message. `getBillingErrorMessage` already exists in the same file and is
already used by the paid-user paths.

- Replace the bare catch with `setMessage(getBillingErrorMessage(err))`.
- Add `checkout_failed` to `ALLOWED_EVENTS` (`backend/app/api/events.py:15`) and emit it from
  `startCheckout` with `{ plan, period, source, reason }`.

Rationale: today the first real checkout failure would be completely invisible. Ship this **with** A1,
not after.

### A3. Let free users try Domain Mode once

`domain_mode_selector` is the dominant upgrade trigger (11 of 17 users) and `sessions.domain_mode` is
NULL on all 263 sessions — nobody has ever experienced the feature they are asked to pay for. The
backend gates are `backend/app/api/chat.py:405` and `backend/app/api/extractions.py:200`, both raising
`DOMAIN_MODE_REQUIRES_PLUS`.

- Add `FREE_DOMAIN_MODE_TRIALS: int = 1` to `backend/app/core/config.py` (follow the existing
  `FREE_*` naming convention around `:153-170`).
- Count consumed trials from durable state — distinct `sessions` rows with a non-null `domain_mode`
  for that user is sufficient and needs no migration. Allow the request when the count is under the cap.
- Both gate sites must use the same helper. Do not gate in the frontend only.
- Route the exhausted case through `PaywallModal` (which already has good `DOMAIN_MODE_REQUIRES_PLUS`
  copy at `PaywallModal.tsx:34-39`) rather than bouncing straight to `/billing`.

### A4. Stop upselling Plus on a limit Plus does not fix

`backend/app/core/config.py:160-162`: `FREE_MAX_FILE_SIZE_MB = 50`, `PLUS_MAX_FILE_SIZE_MB = 50`,
`PRO_MAX_FILE_SIZE_MB = 100`. `file_size` is the most-hit limit in production (12 events / 8 users,
latest 21 Aug) **and produced the only real sale in the product's history**.

- Raise `PLUS_MAX_FILE_SIZE_MB` to 100 and `PRO_MAX_FILE_SIZE_MB` to 200.
- **Check `MAX_PDF_SIZE_MB` (`config.py:64`, default 50) first** — if the per-plan value is clamped by
  it, raise it too, or the change is inert. Verify the actual enforcement path before editing.
- Update the pricing table copy and the plan-comparison table in all 11 locales.
- If the owner prefers not to raise limits, the alternative is to stop routing `file_size` hits to a
  Plus upsell — but do one or the other. The current state upsells a plan with an identical cap.

### A5. Revive the proactive upgrade prompt

`activated_free_user` fired 72 times to 26 real users between 2 and 12 May 2026, then never again.
Cause: commit **`dd5fe38` (2026-05-14)** renamed the event off the `paywall_opened` metric, tightened
eligibility ~4×, and capped it at 3 lifetime impressions per browser, in one unmeasured change. Its
replacement `upgrade_nudge_shown` has fired 13 times to 6 users in three months (last: 8 July).

- `git show dd5fe38` and loosen eligibility and the per-browser cap back toward the May settings.
- Put the event back on a metric that is actually watched.
- Fix the nudge copy: it currently advertises two benefits Plus does not provide, in all 11 locales.

---

## Batch B — First-run / retention

### B1. Fix the first-visit suggested-questions race

The parse worker commits `status='ready'` and only afterwards calls `_queue_document_brief()`
(`backend/app/workers/parse_worker.py`, the embedding-completion block ~`:800-815`). On the frontend,
`frontend/src/lib/useDocumentLoader.ts:107` reads `info.suggested_questions ?? []` the first time it
sees `ready` and unconditionally `clearInterval`s at `:146`. The brief is an LLM call queued after that
commit, so the first visit — the one right after upload — essentially never has questions.

**Preferred fix (smaller, frontend-only):** when `ready` arrives with an empty
`suggested_questions`, do not clear the interval; keep polling on a slower cadence (~3s) for a bounded
window (~60s), then stop. Everything else about the `ready` branch stays as-is.

**Alternative:** queue the brief before the `ready` commit behind a `brief_pending` flag the loader can
poll. Larger, needs a migration; only take it if the polling fix proves insufficient.

Also render the brief itself (summary / key points) in the empty chat pane — 40 briefs exist and are
currently reachable only by a user who opens the document a second time, which 75 of 107 documents
never get.

**Open question for the owner, not in scope here:** 56 of 93 ready documents have no summary at all.
Worth a separate look at why the brief task did not complete for them.

### B2. Stop losing documents that fail to parse

14 distinct parse error codes collapse into one "check your connection" message; the reparse endpoint
has no UI; and errored documents still consume a free-plan slot (production holds 15 errored user
documents: `VECTORIZE_FAILED` ×10, `OCR_FAILED` ×3, `DOWNLOAD_FAILED` ×2, `PERSIST_ELEMENTS_FAILED` ×1).

- Add a Retry control on failed documents wired to the existing reparse endpoint.
- Map error codes to messages that say what actually went wrong (the taxonomy already exists —
  see `errorCopy` / `parseWorkerErrorMsg` used in `useDocumentLoader.ts:96-101`).
- Exclude `status='error'` documents from the free-plan document count.

---

## Batch C — Cheap wins (hours; can ship in parallel with A or B)

### C1. Quote Finder: fire the hint on real phrasing (~2 lines)

`backend/app/services/action_planner.py:185`:
`quote_finder_hint = strict_trigger_matched and _has_suppressing_token(text)` — the chip requires rare
academic quote jargon **and** a negation/metalinguistic token, simultaneously. Realistic phrasing
matches neither branch and falls through to `_fallthrough_plan`, whose `has_citation` branch (`:362-369`)
returns `CITATION_LOOKUP` **with no hint**. Meanwhile `_CITATION_RE` (`:78`) already matches
`where | which page | citation | source | quote | verbatim | 在哪页 | 引用 | 出处 | 来源 | 原文 | 定位`.

- Add `quote_finder_hint=True, quote_finder_hint_topic=text[:_QUOTE_FINDER_HINT_TOPIC_MAX_CHARS]` to the
  `has_citation` branch at `:362-369`.
- Do **not** widen the strict auto-route trigger. Auto-routing is billed and the policy is adjudicated
  (see `.claude/rules/backend.md`, "Chat routing is deterministic-safe"). This change only adds a
  *hint* — the chip never auto-submits.

### C2. Make the Quote Finder funnel measurable — do this FIRST

Chip clicks are rejected by the events allowlist, panel opens are untracked, and chat-routed searches
emit no event. Ship this **before** C1 or you cannot tell whether C1 worked.

- Add the chip-click and panel-open events to `ALLOWED_EVENTS` (`backend/app/api/events.py:15`).

### C3. Put the demo above the fold

On a 1512×793 viewport `/demo` shows a headline, a subhead, ~110px of whitespace and a three-step
explainer before any sample document; the cards begin around y≈780. Move the three cards directly under
the subhead and push "What you will test" below them (or drop it — each card already carries a
suggested question).

Note: the demo cards' suggested questions are hardcoded in the marketing page, not read from the
document (all 5 demo docs have `suggested_questions` NULL). That is fine; just don't "fix" it into a
DB read.

### C4. A failed answer must not cost a demo question

Observed locally: a failed answer left the counter decremented at 4/5 with no retry control and the
typed question lost. (The local failure cause was a network block on the embedding provider, not a
product fault — what needs fixing is the accounting and the dead-end UI.)

- Do not count a failed answer against the 5-message demo allowance.
- Put a Retry control on the failed bubble that resubmits the original question.

Respect the demo counter contract in `.claude/rules/frontend.md` — the accounting was won over six
Codex rounds; do not re-break `demoAccountingEpoch` / the documentId-keyed reset.

---

## Verification contract (per CLAUDE.md)

```bash
cd frontend && npm run build                                   # must pass, not just dev
cd backend && python3 -m ruff check app/ tests/
cd backend && python3 -m pytest tests/test_parse_service.py -v
cd backend && python3 -m pytest -m integration -v               # docker required
```

Plus: exercise the golden path in a browser (upload → chat → citation jump), and for Batch A
specifically, confirm an in-app Domain Mode click now lands on Stripe's hosted page rather than `/billing`.

## Review gate

Batch A touches billing and plan gating → **mandatory Codex adversarial review to consensus** before
merge. Batches B and C are >30 lines of logic → same rule applies. Collab artifacts go in
`.collab/reviews/` and `.collab/dialogue/` per round.

## Sequencing

C2 → C1 (measurable before changed) → A1+A2 (ship together) → A3 → A4 → B1 → B2 → A5 → C3 → C4.
Acquisition work (anonymous upload, non-English structured data, `/tools` internal links, indexable
shared pages) is explicitly **after** these batches — see the report's "What not to do".
