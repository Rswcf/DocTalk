# Batch C — CONSENSUS-SHIP (2026-08-27)

Branch `fix/growth-batch-c`, HEAD `b718493`, based on Batch A. Three rounds:
R1 BLOCK → R2 BLOCK → **R3 SHIP** (empty findings list).

## What shipped

Quote Finder was the strategic bet of v0.24/v0.25 and had **zero real-user adoption** — the only 2
searches and 1 saved quote in production belong to the owner account — while `citation_clicked` fired
60 times across 7 real users over the same window. Users check sources constantly and never reached it.

- **C2 (shipped first, deliberately)** `quote_finder_chip_clicked` and `quote_finder_panel_opened` are
  allowlisted and emitted. Changing the trigger before opening the events would have been unfalsifiable.
- **C1** The chip required rare academic jargon AND a negation token simultaneously, which real phrasing
  never satisfies. `_CITATION_RE` already matched what people type — where / which page / citation /
  source / quote / verbatim / 在哪页 / 引用 / 出处 / 来源 / 原文 / 定位 — but `_fallthrough_plan`'s
  `has_citation` branch returned `CITATION_LOOKUP` with no hint. It now carries the hint. The strict
  auto-route trigger is deliberately unchanged: auto-routing is billed, so this adds a hint only and the
  chip still never auto-submits.
- **C3** `/demo` put a headline, a subhead, ~110px of whitespace and a three-step explainer before any
  sample document; on a 1512×793 viewport the cards began below the fold. Cards now sit under the subhead.

R1 finding 3 (anonymous readers reaching the authenticated panel and being bounced to auth) is closed;
its regression test is kept.

## What was deferred, and why

**C4 — not charging a demo question for a failed answer — was reverted.** R1 found a double release
(five-request cap admitting six). The tokenized fix proved at-most-once but not at-least-once, and R2's
enumeration showed the cause is architectural: `DemoMessageReservation` carries `key + token` with no
storage origin, so a Redis reserve released during a fallback cannot be exactly-once; the in-memory
tracker has no 24h expiry, so a shadow reservation returns later as a hard lock; the token is only
returned after the awaited `EVAL`; and the wrapper takes ownership only at first body iteration.

Making release correct means redesigning the reservation store. C1 is a two-line change that puts the
product's only uncopyable differentiator in front of the users already clicking citations — it should
not wait on that. Spec: `.collab/plans/2026-08-27-demo-counter-release-batch.md` (338 lines: state
machine, origin-bound store interface, 11 invariants, plus an alternative worth costing first — defer
the increment until a successful `done` instead of releasing at all).

**Accepted consequence:** a failed demo answer again consumes one of the five anonymous questions,
exactly as on Batch A. Status quo, not a new defect.

R2's second blocker — client and server diverging so the user hard-locks a question early — is specific
to the release design and dissolves without it: with no release, both sides count the aborted attempt
and agree.

## Verification (Claude's own runs, not the agent's self-report)

| Gate | Result |
|---|---|
| `ruff check app/ tests/` | clean |
| `SKIP_INTEGRATION= pytest -q` | 942 passed / 3 skipped |
| `SKIP_INTEGRATION= pytest -m integration -q` | 48 passed |
| `npm run build` | compiles |
| `npm run test:unit` | 13 passed |

Note: the Codex implementation run was killed by a machine restart before writing its report, and the
first verification pass showed 945 errors — that was the Docker daemon being down after the restart,
not the code. Infra was restored and every gate re-run.

## Not yet done

Not pushed, not deployed. Batch B (first-run suggested-questions race, parse-failure recovery) not
started. C4 and Batch A's deferred hardening rows remain open.
