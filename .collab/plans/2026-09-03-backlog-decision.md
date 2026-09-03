# DocTalk backlog — decision document

Date: 2026-09-03
Author: **Fable 5.1** (planning/architecture authority, per the owner's 2026-09-03 directive:
all 统筹/策划/设计/架构 work is Fable's; Claude and spot subagents execute only).
Base read: `fix/growth-batch-c` @ `6c5d1fa`. Supersedes the sequencing in
`.collab/plans/2026-08-26-growth-fix-batches.md` (§"Sequencing"), which remains valid as the
evidence record.

## 0. Rulings at a glance

| # | Question | Ruling |
|---|---|---|
| 1 | Order | Ship A+C now as v0.29.0 (owner yes/no) → Batch B as v0.30.0 (B1 brief-in-pane, B2 retry+slot rule, B3 = C4-UI, B4 = A5-lite) → 14-day observation → acquisition. Owner does web-filter categorization + one SQL query today, in parallel. |
| 2 | B1 fix | Neither option as written. The polling hook AND the brief renderer already exist and have been orphaned since `7a1546a` (2026-05-09). Consume `useDocumentBrief` in the empty chat pane. No loader change, no migration. |
| 2 | B2 slot rule | Slot = `status NOT IN ('deleting','error')`; errored rows get their own ceiling (= plan max); authoritative check under user-row `FOR UPDATE` next to the INSERT and inside the reparse claim transaction. |
| 3 | C4 | Reject both reserve-then-release and defer-to-done. Ship UI only: expose the existing regenerate path as "Retry" on error bubbles. The 338-line spec is superseded by "accounting change not built". |
| 4 | A5 | After A ships, bundled into B. Eligibility `>=1 ready doc AND >=3 messages`, 7-day re-show, delete the 3-lifetime cap, fix "all AI modes" copy x11. |
| 5 | Deploy | A+C now, backend-first, one version bump. B later. Migrations verified add-only. |
| 6 | Dropped | C4 accounting; `brief_pending` migration; hardening rows 15-18 (extraction dead since 05-08). |

## 1. Ordering, and what is wrong with the batch framing

Against the two walls:

- **Purchase wall** — Batch A is the only work that touches it and it is verified and sitting
  unshipped. Every day it waits is a day with a button that cannot open Stripe and zero production
  signal. Nothing in B changes that calculus, so A does not wait for B.
- **Retention wall** — B1/B2 attack the *first session* (the one 75 of 107 documents only ever get),
  which is the correct first target. But say it plainly: **B is a first-session batch, not a
  retention batch.** Nothing in the backlog gives a user a reason to come back on day 2-4, and
  lifecycle email is vetoed. After B ships, the next decision is driven by one number — does anyone
  reach day 2 — not by another polish batch. The admin retention endpoint already measures this;
  no new instrumentation needed.

Sequence:

1. **Now (owner):** answer the deploy question in §5; submit `www.doctalk.site` for web-filter
   categorization (Symantec/Bluecoat, Palo Alto, Zscaler, Cisco Talos, Fortinet — all have public
   submission forms); run the §2.3 query.
2. **Deploy A+C** as v0.29.0.
3. **Batch B** (one branch, one Codex loop): B1, B2, B3 (C4-UI), B4 (A5-lite).
   Plan-gating in B2 makes the loop mandatory anyway; B1/B3/B4 ride along at low review cost.
4. **Observe 14 days** with named metrics: `checkout_created` from any in-app source;
   `upgrade_nudge_shown -> checkout_created` at `source=dashboard_upgrade_reminder`;
   `quote_finder_chip_clicked / panel_opened`; share of first visits that render questions;
   reparse successes; day-2 actives.
5. **Acquisition** only after (4).

Dropped / postponed indefinitely: C4 accounting; the `brief_pending` migration; hardening rows
15-18 — they protect the extraction/table_scan subsystem, dead in production since 2026-05-08;
revisit only if that subsystem is revived. Do not spend adversarial rounds on it.

## 2. Batch B design ruling

### 2.1 B1 — the fix is already in the tree, unmounted

What the previous plan did not know:

- `frontend/src/lib/useDocumentBrief.ts:14-16, 51-60` already polls `GET /documents/{id}/brief`
  every 4 s while status is `pending` or `empty`, bounded at 10 attempts for `empty`.
- `backend/app/api/documents.py:666-676` already returns `status="empty"` for a ready doc with no
  brief row, `"ready"` with legacy `summary`/`suggested_questions` when there is no row (the
  `legacy_summary` branch), and `"failed"` when `error_code` is set (`:693`).
- `frontend/src/components/DocumentBrief/DocumentBriefPanel.tsx` renders summary/outline/key
  points/questions and handles `failed` (`:209-215`). **No file imports it.** Commit `7a1546a`
  (2026-05-09, "chat-native document tools") removed the Brief tab and the `<DocumentBriefPanel>`
  mount from `DocumentReaderPageClient.tsx` and left the component and hook behind.
- `documentSummary` is set at `useDocumentLoader.ts:110` and stored at `store/index.ts:39,311`
  and **read by no component**. The 40 briefs are unreachable not because of the race but because
  the renderer was unmounted.

Ruling (frontend-only, zero migration, zero new polling code):

1. Leave `useDocumentLoader.ts:107-147` exactly as it is. Do not add polling to the loader; the
   hook already owns that.
2. `DocumentReaderPageClient.tsx:433` — when `documentStatus === 'ready' && !isDemo`, call
   `useDocumentBrief(documentId)` and pass `documentBrief={brief}` into `ChatPanel`. Skip it on
   demo docs: all five have NULL questions, the demo cards hardcode them, and
   `autoSubmitInitialQuestion` fires anyway.
3. `ChatPanel.tsx:530` — the empty state currently requires `suggestedQuestions.length > 0`.
   Change the condition to
   `messages.length === 0 && (questions.length > 0 || brief?.summary || briefPolling)`
   where `questions = suggestedQuestions ?? brief?.questions ?? []`. Render, top to bottom inside
   the existing `dt-empty-workbench` card: summary paragraph (<= ~60 words, `line-clamp-4` on
   mobile); up to 3 `key_points` as a compact list (skip when empty); then the existing question
   buttons. While the hook is polling (`pending`/`empty` within the window) render a two-line
   skeleton in the summary slot; on `failed` render nothing extra (never the error text — the chat
   still works). Do not re-mount the full `DocumentBriefPanel` or its tab — its removal was
   deliberate; consume the hook only.
4. Widen the `empty` poll bound from 10 to 20 attempts (80 s). `brief_worker.py:16-17` has a 210 s
   soft limit but a Flash call on 24 chunks lands well inside 80 s; beyond that the user has almost
   certainly typed already.
5. Keep the zinc/blue app palette; this is app surface.

### 2.2 B2 — retry, honest copy, slot rule

**Error taxonomy.** 13 codes are written by `parse_worker.py`
(`:188, 408, 432, 485, 557, 567, 644, 672, 683, 716, 742, 823, 855`), all with the `ERR_CODE:`
prefix (`:51-61`), and `useDocumentLoader.ts:96-101` already parses the prefix — the "check your
connection" text is only `errorCopy.ts:82-86` falling through because `CODE_TABLE` has none of the
13. Three classes:

- *Retryable (infra):* `VECTORIZE_FAILED`, `OCR_FAILED`, `PERSIST_PAGES_FAILED`,
  `PERSIST_ELEMENTS_FAILED`, `PERSIST_CHUNKS_FAILED`, `CHUNKING_FAILED`, `PARSE_TIMEOUT`,
  `PARSE_FAILED` -> show Retry.
- *Content fault (retry will not help):* `PDF_PARSE_FAILED`, `NO_CHUNKS`, `OCR_INSUFFICIENT_TEXT`,
  `EXTRACTION_FAILED` -> say what is wrong with the file, still allow Retry (cheap, and OCR settings
  can change), secondary Delete.
- *Unrecoverable:* `DOWNLOAD_FAILED` -> the stored object is gone (both production cases are
  MinIO-incident losses); copy says the file is no longer stored, offer Delete and re-upload,
  **no Retry**.

Production's 15: 13 retryable, 2 unrecoverable.

**Copy.** Add the 13 entries to `CODE_TABLE` with `tOr` fallbacks, keys
`errors.<CODE>.title/body`, in all 11 locale JSONs, flat dotted keys.

**Retry control.** Two surfaces, one new client helper `reparseDocument(docId)` in `lib/api.ts`
(does not exist; `deleteDocument` at `:481` is the pattern) -> `POST /api/documents/{id}/reparse`.

- Dashboard row `DashboardPageClient.tsx:630-660`: when `d.status === 'error'`, a Retry button
  beside Open; on 202 flip the row to processing and reuse the existing 2 s status poll at
  `:295-315`; on 409 `DOCUMENT_PROCESSING` just flip to processing (someone else won the claim —
  that is the endpoint's contract, not an error).
- Reader error state `DocumentReaderPageClient.tsx:490-500`: currently only "back home"; add Retry
  for retryable/content classes, Delete for `DOWNLOAD_FAILED`.
- The reparse endpoint (`documents.py:869-925`) keeps its conditional-UPDATE claim, its
  409-while-in-flight behaviour, and the worker's terminal-state gating untouched. Only the plan
  check below is added to it.

**Slot rule (exact, and where enforced).**

- Definition: `slot_count = COUNT(documents WHERE user_id = :uid AND status NOT IN ('deleting','error'))`;
  `errored_count = COUNT(... status = 'error')`.
- Rule A: an upload / URL import / layout-translation import is refused with
  `DOCUMENT_LIMIT_REACHED` when `slot_count >= max_docs`.
- Rule B: it is also refused when `errored_count >= max_docs` (Free <= 3 failed rows alongside <= 3
  live rows) with `reason: "failed_documents"` and copy "delete failed documents to continue".
  This is what makes the exclusion ungameable: failed rows cannot be accumulated to hold storage,
  and there is no path to unlimited rows.
- Rule C (retry-into-success counts again): reparse of a document whose current status is `error`
  requires `slot_count < max_docs` at claim time; otherwise 403 `DOCUMENT_LIMIT_REACHED` and the row
  stays `error`. Reparse of a `ready` doc skips the check (already counted).
- Enforcement: one helper `count_plan_slot_documents(db, user_id) -> (slot_count, errored_count)`
  used at the three existing count sites (`documents.py:220-224`, `:378-382`,
  `layout_translations.py:157-176`) and in `reparse_document`. Concurrency: the early checks at
  upload/ingest stay as unlocked pre-checks (do not hold a lock across the byte stream that starts
  at `documents.py:243`); the authoritative check moves into the same transaction as the `documents`
  INSERT under `SELECT ... FROM users WHERE id = :uid FOR UPDATE` — the pattern A3 already uses for
  trial slots. In reparse, the user-row lock, the count and the conditional UPDATE are one
  transaction. This closes "two concurrent reparses of two errored docs both see 2 < 3".
- Plan-gating change -> mandatory Codex loop; severity bar applies (BLOCK only for paid-feature leak
  or rejecting previously-accepted work).

### 2.3 The 56-of-93 open question — a query, not a guess

Queue starvation is ruled out: `celery_app.py:36,46` routes the brief task to `default`, and
`entrypoint.sh:14` consumes `-Q default,parse`. Remaining candidates: `BRIEF_LLM_UNAVAILABLE`
(`BRIEF_MODEL` is DeepSeek-official at `summary_service.py:29`, needs `DEEPSEEK_API_KEY`, `:73-76`);
no autoretry on `brief_worker.py:13-18` so one transient failure is terminal; documents predating
the table (2026-05-07). 93 ready - 40 rows = 53 with no row at all, which points at the third.
Resolve with one production query before building anything:

```sql
SELECT date_trunc('month', d.created_at) AS m,
       (b.id IS NOT NULL) AS has_brief_row,
       b.error_code,
       (d.summary IS NULL) AS summary_null,
       count(*)
FROM documents d LEFT JOIN document_briefs b ON b.document_id = d.id
WHERE d.status = 'ready' AND d.user_id IS NOT NULL
GROUP BY 1,2,3,4 ORDER BY 1,2,3,4;
```

If it is mostly pre-May rows: no fix, optionally a one-off backfill script. If it is `error_code`
rows: add `autoretry_for=(Exception,)`, max 2, to the brief task. Not in B until the query answers.

## 3. C4 ruling — reject both designs, ship the UI

- **Defer-to-done is worse than status quo.** Moving the increment from `chat.py:433` to the `done`
  emission at `chat_service.py:2578` means an anonymous client that aborts before `done` is never
  counted; the only remaining bound is the 10 req/min/IP limiter, i.e. unlimited free Flash calls at
  10/min. That is a money-loss vector and it breaks the spec's own "at most five concurrent accepted
  attempts" invariant. **Rejected.**
- **Reserve-then-release as specified is disproportionate.** A Lua state machine, a pending-lease
  reaper, an attempt-status endpoint, and client gating of Send/Regenerate/Continue — for a
  five-question counter, motivated by one local failure under a network block. It also re-opens the
  six-round demo-counter contract. **Rejected.**
- **What actually hurts the user** is the dead end and the lost prompt, and that is ~10 lines:
  `MessageBubble.tsx:354` hides the whole action bar when `isError`; `regenerateLastResponse`
  (`useChatStream.ts:403-433`) already trims to the last user message, resends its text, calls
  `bumpDemoUsageForRegenOrContinue()` and re-anchors on failure. Expose `onRegenerate` on error
  bubbles labelled Retry (i18n `chat.retry` x11). The retry costs a demo question and the counter
  shows it — status quo accounting, honest UI, counter contract untouched.
- Supersede `.collab/plans/2026-08-27-demo-counter-release-batch.md` with a two-line status header:
  "Accounting change not built by decision 2026-09-03; only §1's Retry UI shipped as B3."

## 4. A5 ruling — after A ships, bundled into B

- The evidence is not "nudges don't convert": every nudge click before A1 landed on `/billing`,
  where the buy button was never pressed by anyone. Post-A1 the nudge CTA is `beginCheckout`
  (`DashboardPageClient.tsx:428`) — a nudge that opens Stripe has never been tested. It cannot be
  tested before A deploys, so it goes after A, and it is 15 lines + 11 strings, so it rides with B
  rather than earning its own loop.
- Eligibility: `readyDocumentCount >= 1 && total_messages >= 3` (replace `:143-147`). Re-show every
  7 days (`DASHBOARD_NUDGE_SHOW_MS` stays), dismiss 14 days stays, **delete
  `DASHBOARD_NUDGE_MAX_IMPRESSIONS` at `:42` and its check at `:164`** — the lifetime cap is what
  killed the surface.
- Copy: `en.json:2607` now says 100 MB, which A4 made true. "all AI modes" is still misleading —
  Free already has both modes (Flash + capped Pro); the Plus differentiator is unlimited Pro answers.
  Replace with "unlimited Pro answers" in all 11 locales (`ja.json:2445`, `zh.json:2486`,
  `de.json:2488`, and the other seven).
- No metric move needed: `upgrade_nudge_shown` is already on the admin funnel
  (`admin.py:44, 1416, 2088`). Success criterion is `checkout_created` with
  `source=dashboard_upgrade_reminder` > 0 in the observation window.

## 5. The deploy question — for the owner to answer yes/no

**Question:** "Ship Batch A + Batch C to production now as v0.29.0, backend-first, with Batch B to
follow separately as v0.30.0?"

Why this and not one combined ship: A and C are verified (ruff clean, 942/3, 48 integration, build,
13 unit) and B does not exist yet and needs a Codex loop; waiting forfeits days of the only
production signal this whole review can get. Why not A alone: C is three small, reviewed changes on
the same base with no migration.

Risk verified:

- Migrations 0040-0043 are add-only: two `create_table`, three `add_column`, indexes, two `UPDATE`s
  scoped to `document_jobs` in `queued/running` (a dead subsystem, so effectively no rows), one
  `alter_column` adding a `server_default`; all have downgrades. Sole head `20260826_0043`.
- `config.py:214` is `extra="ignore"`, so the now-deleted `MAX_PDF_PAGES` / `MAX_PDF_SIZE_MB` still
  set in Railway are harmless.
- The one behaviour in A that can reject previously-accepted input: fail-closed page counting in the
  upload path (password-locked PDFs, undeterminable page counts; `document_limits.py:39-46`).
  Consensus checked 750 > largest production document. Watch `DOCUMENT_PAGE_LIMIT_EXCEEDED` and
  `PDF_PASSWORD_PROTECTED` counts in week one.

Procedure (per `.claude/skills/deploy/SKILL.md`): bump version in the 3 files on the branch
(`version.json`, `frontend/package.json`, `package-lock.json`; `check_version_consistency.py`),
merge `fix/growth-batch-c` -> `main` -> `stable`, `railway up --detach` from `stable`, wait for
`/health` to report 0.29.0, then `git push origin stable`.

Post-deploy proofs — the first two have never existed for this product:

1. Owner, as a free account, clicks the in-app Domain Mode upgrade -> lands on Stripe's hosted page
   -> cancels. `checkout_created` appears with an in-app `source`.
2. Owner starts a Domain Mode session on a free account -> the trial slot is consumed once, and the
   second attempt shows the paywall modal.
3. `alembic heads` inside the container = 0043; `RAILWAY_REPLICA_REGION` = `us-west2` (the standing
   rule after any deploy).
4. Upload a short PDF -> the reader opens; today it will have no questions on first visit, which is
   B1's baseline.
5. `/demo` shows the cards above the fold at 1512x793.

## 6. What the previous plan got wrong

1. **B1's diagnosis was right; its fix was mislocated.** The bounded polling and the brief renderer
   exist and were orphaned by `7a1546a`. The correct change is a mount, not new loader logic, and it
   also fixes "40 briefs reachable by nobody" in the same stroke.
2. **C4 framed an accounting problem when the user-facing problem is a UI dead end.** The accounting
   change was tried, blocked, and specified into 338 lines; the dead end is fixed by exposing an
   existing code path.
3. **A5's causal story is half right.** The event was not lost from the metric (it is on the admin
   funnel); the lifetime cap and the `/billing` dead end are what killed it. It has never been
   tested against a working button.
4. **Rows 15-18 spend the most expensive resource (adversarial rounds) on a subsystem with no users
   since May.**
5. **"Retention batch" is a misnomer.** B is first-session work. After it ships, the day-2 number
   decides the next batch, and no candidate in this backlog addresses day 2.
6. **The plan's sequence put A5 before C3/C4** — moot now, but it reflected treating the nudge as a
   purchase lever, which the evidence never supported before A1.

Owner-only, zero engineering, today: the domain categorization (§1 step 1). The ICP sits behind
exactly those filters; the KPMG block is a live acquisition leak that no batch can fix.

---

## Appendix — Claude's independent verification of this document's load-bearing claims

Run 2026-09-03 on `fix/growth-batch-b` @ `6c5d1fa` (identical tree to `fix/growth-batch-c`).
Per the standing rule, code claims are re-read at source and never taken from an agent's self-report.

| Claim | Result |
|---|---|
| `useDocumentBrief.ts` polls every 4 s on `pending`/`empty`, bounded at 10 for `empty` | CONFIRMED (`:14-16`, `:51-60`, `window.setInterval(..., 4000)`, `pollAttempts >= 10`) |
| `DocumentBriefPanel.tsx` exists and **no file imports it** | CONFIRMED — grep over `frontend/src` returns zero importers |
| `useDocumentBrief` reachable only through that orphan | CONFIRMED — its only importer is `DocumentBriefPanel.tsx:17,129` |
| `documents.py` brief endpoint emits `empty` / `pending` / legacy `ready` / `failed` | CONFIRMED (`:666-676` and the `error_code` branch) |
| `documentSummary` is written but read by no component | CONFIRMED — only `store/index.ts:39,157,311,350` |
| `7a1546a` (2026-05-09) removed the Brief tab and the mount | CONFIRMED — diff deletes the import, `workspaceMode 'brief'`, the tab button and `<DocumentBriefPanel .../>` |
| `MessageBubble` hides the action bar on error | CONFIRMED — gated `isAssistant && !isError && message.text` |
| `DASHBOARD_NUDGE_MAX_IMPRESSIONS = 3` at `:42`, checked at `:164` | CONFIRMED; note current eligibility is `readyDocumentCount >= 2` at `:144`/`:149`, not `:143-147` |
| `errorCopy.ts` falls through to a generic connection message | CONFIRMED — `CODE_TABLE` miss -> `STATUS_TABLE` miss -> `errors.NETWORK.*` |

No claim failed verification. The single correction is the line number for the nudge eligibility
condition (`:144`, not `:143-147`); the ruling is unaffected.
