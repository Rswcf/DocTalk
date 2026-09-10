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

---

## 7. Addendum — implementation gaps (Fable 5.1, same day)

Four details the sections above left open. None changes a ruling; each would ship a visible defect
or miss a checklist item if the document were followed literally.

1. **B2 reader-page Retry must re-arm the loader.** `useDocumentLoader.ts:95-105` sets `error` and
   `clearInterval`s on `status === 'error'`, and the effect is keyed only on `documentId` (`:163`).
   After a 202 from reparse nothing restarts the poll, so the reader would keep showing the error —
   a dead Retry button, the exact defect class B2 exists to remove. Spec: the reader's Retry bumps a
   `reloadKey` included in the effect deps, or navigates to the dashboard on 202, whose own 2 s poll
   (`DashboardPageClient.tsx:295-315`) handles it. Dashboard-row Retry is unaffected.
2. **B2 Rule A's authoritative check must clean up the stored object.** Order in
   `doc_service.create_document` is object put → `documents` INSERT + commit → dispatch. Moving the
   authoritative slot check next to the INSERT means a race-losing upload has already written its
   MinIO object. Spec: on the authoritative reject, delete it via
   `asyncio.to_thread(storage_service.delete_file, storage_key)` — already the idiom in the delete
   path — before raising 403. Same for URL import. Without this the concurrency fix leaks storage on
   every rejected race.
3. **The §5 deploy procedure omits the changelogs.** `.claude/skills/deploy/SKILL.md:24-25` reads
   "Version bump = 3 files + changelogs"; `CHANGELOG.md` and `CHANGELOG.zh.md` both exist and both
   need an entry alongside `version.json`, `frontend/package.json`, `package-lock.json`.
4. **A5 copy: do not write "unlimited Pro answers".** Plus Pro answers are still bounded by the
   3,000-credit month, so that trades one overclaim for another and Codex will read it that way.
   Use **"Pro answers without the monthly cap"** (or "no cap on Pro answers") — it names the real
   differentiator versus Free's capped Pro answers without claiming unlimited.

### Claude's verification of the addendum

| Claim | Result |
|---|---|
| Loader's `error` branch sets error, `clearInterval`s, returns | CONFIRMED (`useDocumentLoader.ts:95-105`) |
| Its effect deps contain no reload key — only `documentId` + stable setters + `t`/`tOr` | CONFIRMED (`:163`) — a reparse 202 would not restart the poll |
| `create_document` puts the object **before** the INSERT + commit, then dispatches | CONFIRMED — `asyncio.to_thread(storage_service.upload_file, ...)` precedes `db.add(doc)` / `await db.commit()` |
| `asyncio.to_thread(storage_service.delete_file, storage_key)` is the existing cleanup idiom | CONFIRMED (delete path, `doc_service.py:~156`) |
| Item 3 already satisfied | YES — the v0.29.0 bump commit `8e93934` carries both changelogs plus the 3 version files; `check_version_consistency.py` OK |

Line numbers in items 1–2 are approximate by a few lines; the orderings they depend on hold exactly.

---

## 8. Re-sequencing after the v0.29.0 deploy (2026-09-07)

### 8.0 Release record — what actually happened

**v0.29.0 (Batch A + C) shipped to production 2026-09-07, backend-first, in the skill's order.**

| Event | UTC | Evidence |
|---|---|---|
| Railway backend deployment SUCCESS | **00:22:30** | GraphQL `deployments` on service `1e25a8b5`, newest node |
| `/health` polled to `0.29.0` | before 00:25 | 150s poll from `railway up` to first `0.29.0` response |
| `alembic current` **inside the container** | before 00:25 | `20260826_0043 (head)` |
| `RAILWAY_REPLICA_REGION` | before 00:25 | `us-west2` (standing post-deploy rule) |
| `git push origin stable` | **00:25:40** | GitHub push event, `84bcbc7..8e93934` |
| Vercel deployment created | **00:27:45** | GitHub deployments API, sha `8e93934`, success |

The backend was live **three minutes before** the frontend push. Steps 3 and 4 of
`.claude/skills/deploy/SKILL.md` were executed and verified, not skipped.

**Correction to the record:** a re-sequencing ruling drafted while the deploy was still running
sampled `/health` before 00:22:30, concluded production was serving a v0.29.0 frontend on a v0.28.1
backend, and recommended treating it as a frontend-first process incident with a revert contingency
and a freeze on `stable` pushes. That premise was false and those recommendations are void. Recorded
here because the mistaken version was circulated: **no mixed state existed, and no incident occurred.**
The deploy had been blocked for four days only because the Railway CLI was authenticated to an account
(`yijie.ma94@gmail.com`) that the DocTalk project returns `Not Authorized` for; re-authenticating to
`yijiema123@icloud.com` unblocked it.

Gates on the deploy candidate: ruff clean, sole head `20260826_0043`, 942 passed / 3 skipped,
48 integration, version check OK. Post-deploy: `/`, `/demo`, `/pricing`, `/use-cases/lawyers`,
`/trust` all 200; the release-specific string "100 MB uploads" present in the served homepage chunk.

*Verification note:* the site HTML is edge-cached. A plain `curl` returned the previous build's chunk
hashes for six minutes (`x-vercel-cache: HIT`, `age: 339`) and looked exactly like a stuck Vercel
build. `curl -H 'Cache-Control: no-cache'` returned the new build immediately. Use that when verifying
a frontend deploy; the backend has a real version endpoint and needs none of it.

### 8.1 Batch B merges into the next ship — one deploy to v0.30.0

Superseding §1's "Batch B as v0.30.0 following separately": there is now one ship, not two. The only
reason the original sequencing gave for splitting them was that B did not exist yet; B is now at
CONSENSUS-SHIP. Deploy events are owner-gated and therefore the scarce resource. B carries no
migration, and a v0.29.0 frontend runs unchanged against a v0.30.0 backend — B's backend changes
(a `reason` field on a 403, the reparse plan check, `FOR NO KEY UPDATE` on the trial mutex, the
`create_collection` reorder) alter no contract the live frontend uses. Attribution survives because it
is per metric, not per deploy: A → `checkout_created`; C → the Quote Finder events; B → brief-rendered,
reparse outcomes, nudge conversion.

`main` is at `724f936` (v0.30.0) for CI and the Vercel preview; `stable` stays at `8e93934` until the
next backend deploy.

### 8.2 Rollback is not "redeploy the previous version"

`backend/entrypoint.sh` sets `set -e` (line 4) and runs `alembic upgrade head` (line 8) before starting
anything, so once `0040-0043` are applied, the v0.28.1 image — whose tree has no `20260826_0043` —
cannot resolve head and crash-loops. Safe rollback is an image >= v0.29.0, or
`alembic downgrade 20260808_0039` first, which DROPS `checkout_attempts` and `feature_trial_usages`.
CI proves the downgrade path on every run (`upgrade head -> downgrade base -> upgrade head` on
Postgres 16.6). Written into `.claude/skills/deploy/SKILL.md`.

### 8.3 The credential, not the login

The recurring block is not "the owner forgot to log in" — it is that deploys require an interactive
login to an account only the owner holds. There is no account-free path: `ci.yml` is test-only, the
repo has no GitHub secrets, there is no `RAILWAY_TOKEN` anywhere, Railway has no GitHub integration
(deploys are manual `railway up`), and the Vercel CLI is unauthenticated. Hobby workspaces cannot add
members, so inviting a second account is not available.

The fix is a **Railway project token** scoped to the production environment
(`RAILWAY_TOKEN=xxx railway up --service backend`, no `railway link` required), stored chmod-600
outside the repo. That also unblocks the §2.3 production query, which has been waiting since 2026-09-03.

### 8.4 Stop-line

After the v0.30.0 ship: the observation readout script (read-only, `prod_metrics.py` pattern, owner
excluded, deploy date as the cut) and nothing else. Explicitly not started: anonymous upload,
structured data on the locale URLs, `/tools` internal links, `add_documents_to_collection`'s
FK-violation race, the brief backfill, and Batch A hardening rows 15-18. The next real decision is
driven by the day-2 retention number, which needs production traffic on the shipped code — not by
another batch built on a base that has never run in production.

Tags: `v0.28.1` = `84bcbc7`, `v0.29.0` = `8e93934`.

### 8.5 §2.3 resolved — the missing summaries are pre-table legacy, not a broken worker

Query run against production 2026-09-07 (the DSN is `DATABASE_PUBLIC_URL` on the Postgres service;
`prod_metrics.py`'s `DB=` expects exactly that). Result, ready user-owned documents by month:

| Month | brief row | error_code | summary NULL | n |
|---|---|---|---|---|
| 2026-03 | no | – | yes | 8 |
| 2026-04 | no | – | yes | 30 |
| 2026-04 | yes | – | no | 1 |
| 2026-05 | no | – | yes | 18 |
| 2026-05 | yes | – | no | 20 |
| 2026-06 | yes | – | no | 4 |
| 2026-07 | yes | `BRIEF_JSON_INVALID` | yes | 1 |
| 2026-07 | yes | – | no | 1 |
| 2026-08 | yes | – | no | 18 |
| 2026-09 | yes | – | no | 3 |

**56 documents have no `document_briefs` row at all, and all 56 are March–May** (8 + 30 + 18). May is
the transition month — 18 without a row, 20 with — consistent with the table landing mid-May. From June
onward every ready document has a brief row.

**Exactly one brief has ever failed with an error code** (`BRIEF_JSON_INVALID`, July) in six months.

Per the §2.3 decision rule ("mostly pre-May rows → no fix; `error_code` rows → add autoretry"), the
ruling resolves to **no fix**. Adding `autoretry_for` to the brief task is not justified by one failure
in six months. A one-off backfill for the 56 legacy documents remains optional and is NOT scheduled —
those documents' owners have not returned, which is the retention problem, not a brief problem.

Day-0 baseline at T_A (owner included in raw counts): 171 users, 104 ready user-owned documents,
49 brief rows, **0 active subscriptions**, 15 documents in `error` (ids snapshotted for the reparse
readout). `product_events` since T_A: none yet.

### 8.6 Pre-registered success criteria for 2026-09-21 (Fable 5.1, dated commitment)

Readout: `backend/scripts/observation_window.py` (read-only, owner excluded,
`DB=<DATABASE_PUBLIC_URL>`). Recorded **before** the window runs so the 09-21 result is compared to a
commitment rather than to memory.

**Sample size gates everything.** At ~1 signup/day the window yields ~14 users. Every criterion below
is an **existence threshold**, not a rate. **If non-owner signups since T_A are < 10 on 2026-09-21,
extend the window until n = 10 before deciding.** Reporting "no effect" at n < 10 is not permitted.

**Source classification — corrected from the ruling.** The ruling enumerated 12 in-app
`upgrade_click` sources. The codebase actually emits **30+** (`quote_save`, `profile_credits`,
`message_actions`, `document_toolbar`, `demo_limit_panel`, `collection_reader`,
`dashboard_upload_precheck`, `layout_translation_toolbar`, `billing_cancel_modal` … were all missing).
A hardcoded in-app list would silently drop signal as sources are added, so the script inverts it:
**marketing** = `pricing, pricing_hero, hero, final_cta, public_header, features_layout_translation`
(these land on `/billing` and are not what A1 fixed); everything else counts as in-app.

**Defect triggers — act immediately, do not wait for 09-21:**
- in-app `upgrade_click` >= 1 by a non-owner with `checkout_created` = 0, or any `checkout_failed`
  → the button is still broken for a real user; read `checkout_attempts`.
- a day-0 snapshot document retried >= 3 times without reaching `ready`, or any `failed_documents`
  rejection → read the code.

**Criteria:**

| Area | Metric | Threshold |
|---|---|---|
| Purchase (A1/A2) | in-app `upgrade_click` I, `checkout_created` C | C >= 1 → the button works in the wild; the wall becomes price/value, measurable for the first time. I = 0 → absence of intent, not evidence about the button. `checkout_completed` >= 1 → first live subscriber. |
| Domain Mode (A3) | non-owner `feature_trial_usages` rows since T_A | >= 1 → the #1 intent source converts to usage for the first time in 263 sessions. Then measure post-trial intent from that user. |
| Quote Finder (C1/C2) | chip clicks, panel opens, and `credit_ledger` `reason='quote_search'` | >= 1 non-owner search = first adoption ever. Clicks with no search = the panel loses them. No chip-shown event exists, so CTR is unmeasurable — do not add one now. |
| First session (B1) | zero-message rate per document, `[T_A−60d, T_B)` vs `[T_B, +14d)` | Readable only as the zero-message rate halving, or >= 1/3 of first messages matching a suggested question. Otherwise report "unreadable at this n", never "no effect". |
| Parse failures (B2) | day-0 snapshot documents reaching `ready`; new error documents | any retry-into-ready = a dead end removed. Expected 0–2. |
| Nudge (B4) | `upgrade_nudge_shown`, then `upgrade_click` and `checkout_created` at `source=dashboard_upgrade_reminder` | shown >= 1 = the surface is alive again (base since the lifetime cap: 0). `checkout_created` >= 1 is §1's stated criterion. |
| **Day-2 (the decider)** | non-owner, first activity >= T_A, active on a later calendar day within 7 | base over seven months = **0**. >= 1 → read what they returned to do; that is the retention hook and the next batch. 0 with n >= 10 → confirms B was first-session work. |

**Not measurable here, by construction:** `DOCUMENT_PAGE_LIMIT_EXCEEDED` and
`PDF_PASSWORD_PROTECTED` reject before the `documents` INSERT, and the upload path's `limit_hit` only
carries `file_size`/`upload_limit` (`DashboardPageClient.tsx:342`) — they read zero regardless of what
happens. Their instrument is Railway logs. The script says so in its header rather than printing a
misleading zero.

**Decision rule at 2026-09-21:**
- any of C >= 1, a trial claim followed by intent, a non-owner quote search, or day-2 >= 1 → follow
  that thread; the next batch is whatever that user did.
- everything zero **with n >= 10** → the product walls cannot be measured at 1 signup/day. The next
  work is ICP-targeted acquisition: the web-filter categorization first (owner-only), then locale
  structured data and `/tools` links. The 2026-08-25 thesis stands — this is traffic *quality* toward
  lawyers and analysts, not volume.
- n < 10 → extend; decide at n = 10.

Baseline at T_A (smoke-run 2026-09-07, ~25 min after deploy): every metric above reads 0, including
0 non-owner signups. That is the zero line the window is measured against.

## 9. Ruling on the measured signup rate (2026-09-08, Fable 5.1)

Trigger: the lead measured the real non-owner signup rate in production today — 0.29/day (7d), 0.43
(14d), 0.67 (30d), 0.51 (90d); 0 non-owner signups and every §8.6 metric at 0 in the 28h since T_A.
§8.6 assumed ~1/day and gated "everything" on n >= 10. Everything below was written **before any
criterion has produced a non-zero read**, so none of it can have been fit to data.

### 9.0 Rulings at a glance

| # | Question | Ruling |
|---|---|---|
| 1 | Window | The single n >= 10 signup gate is withdrawn — the script never applied it to purchase/trial/Quote Finder/nudge anyway (§9.2). Per-criterion existence gates replace it (§9.3). **2026-09-21 = checkpoint** (defect triggers + first reads). **2026-09-28 = decision date** (T_A + 21d: >= 90% odds of the first intent event at historical rates, and the median n = 10 date at the 90-day rate). Decide early on a non-owner day-2 return (positive) or the refined defect trigger (negative). |
| 2 | Thesis | Not inverted — completed. 08-25 said "fix the walls, then acquire"; walls are shipped/staged; its own step ⑥ is now due. The lead's sharper reading is correct: at ~0.5/day acquisition is binding **for learning**. For revenue the two walls and acquisition are jointly binding until the first intent event, which is decidable on any active user, not on new signups. |
| 3 | Acquisition | Starts now, bounded to work that does not touch the observed surface. Order: owner items first (web-filter categorization, Railway token — nothing below substitutes for them), then one frontend-only branch (locale structured data, `/tools` inlinks, no-signup post CTA → `/demo`), ready by 2026-09-12, shipped as a separate `git push origin stable` with **no version bump**. Anonymous upload and indexable share pages stay out until 09-28. v0.30.0 is not re-staged for any of it. |
| 4 | v0.30.0 | Ship on the owner's go-ahead, now. No migration → plain-redeploy rollback. A late T_B splits an already tiny cohort; an early one makes the n = 10 cohort homogeneous on B code. T_B stays mandatory as the attribution key, not as a before/after instrument. |

### 9.1 Three corrections to §8.6 — owned as errors, not extensions

1. **"~1 signup/day" was wrong on the day it was written.** The 08-25 review already had August at
   17 signups / 31 days ≈ 0.55/day (`memory/topdown-review-2026-08-25.md`). The measured 90-day rate
   (0.51) is that number. Nothing new was falsified; the assumption was never checked.
2. **"Sample size gates everything" was prose, not code.** `observation_window.py` keys on
   `users.created_at >= T_A` in exactly two places — the gate itself (`:60`) and day-2 (`:148-155`).
   Purchase (`:68-74`, `:87-93`), the trial (`:97-98`), Quote Finder (`:103-106`) and the nudge
   (`:142-144`) count events since T_A from **any** non-owner. Those criteria were never signup-gated
   in the instrument; the n >= 10 sentence over-applied to them.
3. **"Day-2 base over seven months = 0" is unverified and probably wrong.** 08-25 recorded 8 users
   with 2 active days and 3 with 3 (out of 62 ever-active); "0" was true of the August cohort and of
   4+ active days. The base for the script's within-7-days definition has never been run. It decides
   whether n = 10 can ever read a negative (§9.3), so the lead should run it — SQL in §9.8.

On "declining": n = 2 in 7 days cannot separate 0.29/day from 0.5/day (P(<= 2 | 0.5/day) = 0.32), and
0 signups in 28h at 0.5/day happens 56% of the time. The 7-day and 28-hour numbers are noise. The
substantive concern survives the correction: at 0.5/day the window is three weeks, not two, and the
day-2 negative branch is unreadable at any attainable n.

### 9.2 What the instrument actually measures

| §8.6 row | Population counted (from the script) | Needs new signups? |
|---|---|---|
| Purchase A1/A2 | every non-owner `upgrade_click`/`checkout_*` since T_A | no |
| Domain Mode A3 | every non-owner `feature_trial_usages` row since T_A | no |
| Quote Finder C1/C2 | every non-owner chip/panel event and `quote_search` ledger row since T_A | no |
| First session B1 | ready non-owner documents by `created_at`, before/after T_B | no (per document) |
| Parse failures B2 | the 15 day-0 error docs + new error docs | no — but needs their owners to **return** |
| Nudge B4 | every non-owner `upgrade_nudge_shown` since T_A | no |
| Day-2 | non-owner users with `created_at >= T_A` | **yes — the only one** |

### 9.3 Denominators — which claim is decidable on what

| Claim | Denominator | Decidable at | Expected wait (historical rate, recalled from 08-25 — refresh with §9.8) |
|---|---|---|---|
| The button opens Stripe | in-app `upgrade_click` by an authenticated, known-free non-owner | the **first** event: `checkout_attempts` row within 60s → works; none → §9.8 refined trigger | ~4 in-app intent users/month → 85% by 14d, 94% by 21d |
| Price/value is the wall | `checkout_created` | needs C >= ~5 (Stripe has 5 sessions ever) | not this quarter — record, do not decide |
| The trial converts intent to usage | free non-owners who open the Domain Mode selector | first `feature_trial_usages` row; a `domain_mode_selector` `upgrade_click` by a free user with **no** trial row = defect | ~3.2 selector users/month → 78% / 89% |
| Quote Finder is used | non-owner `citation_clicked` users (the population the C1 chip now reaches) | first non-owner `quote_search` ledger row; chip/panel events with no search = the panel loses them | ~1.75 citation-clicking users/month → 56% / 71% |
| Nudge surface is alive | eligible non-owners (>= 1 ready doc, >= 3 messages) visiting the dashboard after T_B | first `upgrade_nudge_shown` | days after T_B (any of ~10 MAU qualifies) |
| B1 halves the zero-message rate | ready non-owner documents after T_B | ~30 post-T_B documents for a 23% → 12% halving to be visible even loosely | ~15 docs/month → ~2 months. **Unreadable.** Keep only the existence half: first user message equal to a stored `suggested_questions` entry. |
| B2 removes a dead end | the 15 day-0 error docs | any retry-into-ready | their owners never returned (retention = 0) → expected 0 **by construction**. Report "unread", never "B2 failed". |
| Someone returns on day 2 | **(amended — see §9.11)** non-owner users whose first active day is >= T_A, with >= 7d exposure | a *reported rate* against the measured base, not an existence read: one return at n = 10 is the null (P >= 0.63). Thresholds in §9.11. | not a decider in either direction at any n reachable this quarter |
| **Someone reaches a 4th distinct active day (the wall)** | any non-owner, any signup date, 4th distinct user-message day >= T_A | first such user — base over seven months: **0 of 67 ever-active users** | standing metric, no calendar deadline; the 4 users at 3 days are closest (§9.11) |

On the lead's alternatives: a per-session/per-document denominator helps B1 and the nudge a little
(their unit arrives faster than users) but does not rescue the halving test and does nothing for day-2,
which is per-user by definition. The 15 recent messages are the population that generates the purchase,
trial and Quote Finder signals — the lead should report distinct users behind them, split by signup
before/after T_A. The 171 existing users are dormant with no channel (lifecycle email vetoed); they
matter only as the ~10 MAU who return unprompted, and those MAU **are** the denominator for every
non-day-2 row.

### 9.4 Dates

Days from T_A (2026-09-07 00:22Z) until the 10th non-owner signup, Poisson arrivals:

| Rate | 20% | 50% | 80% |
|---|---|---|---|
| 0.67/day (30d) | 09-17 | 09-21 | 09-25 |
| 0.51/day (90d) | 09-21 | **09-26** | 10-01 |
| 0.43/day (14d) | 09-24 | 09-29 | 10-06 |
| 0.29/day (7d) | 10-02 | 10-10 | 10-20 |

- **2026-09-21 — checkpoint, not decision.** Run the readout; act on defect triggers; record first reads.
- **2026-09-28 — decision.** By then the first in-app intent event has ~94% odds, the trial ~89%, the
  nudge is near-certain if v0.30.0 ships this week, and n = 10 is at its median. Each row decides on
  its own gate (§9.3). If **no intent event of any kind** has arrived by 09-28, that is the finding:
  the active base cannot produce one intent event in three weeks, and acquisition is confirmed binding
  for learning. Do not extend past 09-28 waiting for signups.
- **Decide early** on either: (a) **(amended — see §9.11; the day-2 version of this bullet was error #4)** any non-owner reaching a 4th distinct active day — read that user's whole history, the wall broke; (b) the refined defect trigger (§9.8) firing — fix it immediately. `checkout_created >= 1` on its own is confirmation (the button works), not a decision:
  it moves the purchase question to price/value, which §9.3 says is undecidable at this traffic, and
  08-25 already ruled out price cuts on one data point.

### 9.5 The thesis is completed, not inverted

08-25 said traffic was not binding **while the walls were broken** — traffic into a button that never
opened Stripe was wasted — and ordered acquisition as step ⑥ after ①–⑤. ①–⑤ are v0.29.0 (A, C) and
the staged v0.30.0 (B). The thesis's own sequence now says: acquire. What today's measurement adds is
that the *wait* was mis-sized (§9.1.1), and the lead's reading is right: at ~0.5/day acquisition is the
binding constraint **for learning**, regardless of which wall binds revenue. For revenue the honest
statement is "jointly binding until the first intent event" — and that event is decidable on any
active user (§9.3), which is why acquisition and the readout run in parallel rather than in sequence.

### 9.6 Acquisition starts now — with a boundary

§8.4's stop-line protected the **observed surface** (chat, reader, billing, dashboard) so the
registered metrics keep their meaning. Acquisition work that changes who arrives, not what happens
after arrival, does not confound them, and its effect lags by weeks, so every week it waits is a week
of compounding lost. The stop-line stands for product batches; it does not cover the items below.

**0. Owner, zero code, today — nothing below substitutes for these.**
- Web-filter categorization for `www.doctalk.site` (Symantec/Bluecoat, Palo Alto, Zscaler, Cisco
  Talos/Umbrella, Fortinet, Forcepoint, Netskope). Ruled "today" on 09-03 (§1); still uncategorized
  on 09-08. The ICP sits behind these gateways with the contract they want to upload.
- Railway project token (§8.3), so a deploy stops being a multi-day block.

**1. Branch `growth/acquisition-1` — frontend-only, ready by 2026-09-12, Codex-reviewed.**
- Locale structured data: `frontend/src/lib/marketingLocalePage.tsx:60-66` renders only the generic
  `MarketingArticleJsonLd` for all 33 `LOCALIZED_PATHS` × 10 URL locales, while the English roots
  emit `FAQPage`/`HowTo`/`SoftwareApplication`/`BreadcrumbList` (`app/page.tsx`,
  `features/citations/page.tsx`, `use-cases/lawyers/LawyersJsonLd.tsx`). The factory is a single
  choke point: add `BreadcrumbList` for every localized page and `FAQPage` wherever the page's
  Content renders `EdFaqList` (FAQ copy exists in all 11 locales). Localized `SoftwareApplication`
  with offers on `/[locale]` and `/[locale]/pricing`.
- `/tools` inlinks: zero exist (`i18n/routing.ts:63` registers the path; nothing in
  `frontend/src/components` links it). Footer group (`Footer.tsx:81-126` pattern) + `EdRelatedLinks`
  on `/features/free-demo` and the blog index, EN and locale.
- The ranking no-signup post: locate its source (not under `frontend/src` by slug grep) and point
  its primary CTA at `/demo` — the surface that actually is no-signup. Copy stays.
- Ships as `git push origin stable` — no `railway up`, no backend-first choreography, no migration.
  Still a production deploy and therefore a **second owner ask**, but a cheaper one. **No version
  bump on a frontend-only push**: `backend/app/core/version.py:22-36` reads the container's baked
  `version.json`, so a bump would make `/health` report a version that is not deployed.
- v0.30.0 stays frozen at `0f1a1d7`. This branch merges to `main` after `stable` moves. If the owner
  prefers one push, fold in only after the branch is CONSENSUS-SHIP and re-run every gate — the
  owner's call, not the default.

**2. Not now — decide at 09-28 with intent data in hand.** Anonymous upload (changes the funnel's
unit: arrival stops meaning signup, the day-2 definition breaks, IP quotas/storage/cleanup are abuse
surface, backend + Codex loop + owner deploy). Indexable share pages (backend `noindex` + attribution).

If the owner does neither item in (0), the frontend work is second-order: the ICP cannot reach the
site from work, and every ship remains a multi-day block. Say it plainly; this ruling cannot substitute
for either.

### 9.7 v0.30.0 ships now, on the owner's go-ahead

Verified: `main` = `0f1a1d7` = `origin/main`; `stable` = `8e93934` (v0.29.0); `git diff stable main`
touches 66 files, **no `alembic/versions/` change, no `events.py` change** (metric names keep their
meaning). Reasons to ship today rather than after the window: (a) every arriving user hits the empty
first pane until it ships — the rate is small, the fix is done; (b) the window is extending anyway, so
an early T_B makes the n = 10 cohort homogeneous on B code instead of split; (c) no migration → §8.2's
trap does not apply, rollback is a plain redeploy of `8e93934`; (d) the nudge (B4) is the fastest
existence signal in §9.3 and does not exist before T_B. The [T_A, T_B) A+C-only window has 0 signups
and was never going to read; attribution is per metric (§8.1), so nothing is lost. T_B remains
mandatory — not for a before/after, which is unreadable at this n, but so that "which code was live
when this user did X" is recorded, never reconstructed. Owner go-ahead is required; a peer ruling is
not authorization.

### 9.8 Instrument refinements (specified, not applied — the candidate is frozen)

Apply on a branch after `stable` moves, or run by hand. `OWNER`/`MARKETING` as in the script.

1. **Refined defect trigger (replaces `:80-81`).** Two false-positive paths exist in the current test:
   `billing.ts:69-85` fires `upgrade_click` on the navigate-to-`/billing` branch as well as the
   checkout branch, with no distinguishing property, and `decidePlanAwareBillingAction` (`:33`) routes
   to checkout only for `currentPlan === 'free'` — `profile?.plan` undefined at click time is a
   designed fallback to `/billing`. And `DashboardPageClient.tsx:214` passes `'free'` for anonymous
   visitors, whose `upgrade_click` is a `PUBLIC_EVENT` (`events.py:60-72`) persisted with NULL
   `user_id` while their `checkout_failed` is rejected (401) — so an anonymous click reads as an
   in-app non-owner click with no checkout.
   ```sql
   select e.id, e.user_id, e.created_at, e.metadata_json->>'source' src, u.plan plan_now,
     exists (select 1 from checkout_attempts a where a.user_id = e.user_id
             and a.started_at between e.created_at - interval '5 seconds'
                                  and e.created_at + interval '60 seconds') attempted,
     exists (select 1 from product_events b where b.user_id = e.user_id and b.event_name = 'billing_view'
             and b.created_at between e.created_at and e.created_at + interval '60 seconds') fell_back
   from product_events e join users u on u.id = e.user_id
   where e.event_name = 'upgrade_click' and e.created_at >= '2026-09-07T00:22:30Z'
     and e.user_id is not null and e.user_id::text <> :owner
     and coalesce(e.metadata_json->>'source','') <> all(:marketing)
   order by e.created_at;
   ```
   Read: `attempted` → the button works. `plan_now='free' and not attempted and fell_back` → the
   plan-undefined fallback fired (design gap: plan not loaded at click; not a broken button).
   `plan_now='free' and not attempted and not fell_back` → **DEFECT**. Dedupe per user-hour: a fallback
   click followed by the `/billing` button yields two in-app clicks for one checkout.
2. **Print the active-user denominator** next to the signup gate:
   ```sql
   select count(distinct s.user_id) filter (where u.created_at >= :ta) new_users,
          count(distinct s.user_id) filter (where u.created_at <  :ta) returning_users
   from messages m join sessions s on s.id = m.session_id join users u on u.id = s.user_id
   where m.role = 'user' and m.created_at >= :ta and s.user_id::text <> :owner;
   ```
3. **Print the day-2 base** beside the window number — the script's `:148-155` CTE with
   `u.created_at >= '2026-02-01' and u.created_at < :ta`. Replace the `:158` "confirms B was
   first-session work" branch with "no evidence at this n".
4. **Refresh the recalled intent rates** (last 90 days, authenticated non-owners, distinct users):
   `upgrade_click` with in-app source; `upgrade_click` with `source='domain_mode_selector'` (pre-T_A
   only — post-A3 the same click becomes a `feature_trial_usages` row); `citation_clicked`. Re-derive
   the §9.3 waits from those; the 09-28 date holds unless in-app intent is below ~2 users/month.

### 9.9 Owner asks, in order

1. Go/no-go on v0.30.0 (§9.7).
2. Web-filter categorization submissions (§9.6.0).
3. Railway project token (§8.3).
4. Later, a second `stable` push for `growth/acquisition-1` (§9.6.1).

### 9.10 Measurements answering §9's open queries — and one correction §9 did not anticipate

Run against production 2026-09-08 (owner excluded, cohort = signups since 2026-02-01, n=170).
§9 requested all three; the first invalidates a constant §8.6 relied on, and its consequence is larger
than a corrected number.

**A. The day-2 base rate is ~0.09, not 0.** Robust across definitions, so not a midnight artifact:

| Definition | returned | p |
|---|---|---|
| later calendar day, ≤ 7d (as §8.6 specified) | 16/170 | **0.094** |
| gap ≥ 24h, ≤ 7d (artifact-proof) | 14/170 | 0.082 |
| gap ≥ 24h, any time later | 18/170 | 0.106 |

`P(read 0 | nothing changed)` = **0.35 at n=10**, 0.12 at n=20, 0.01 at n=45. §9's retraction of the
negative branch is confirmed; n≈45 is where a zero read becomes informative.

**B. The positive branch is compromised too, which §9 did not intend.** At p≈0.09, one return on a
later day is what ~9% of users do anyway. On a 09-28 cohort of ~10 that is close to a coin flip under
the null, so "day-2 ≥ 1 → that session is the next batch" risks building a batch off noise.

**The wall is at day 4, not day 2.** Distinct active days, all non-owner users, all time:

| active days | users |
|---|---|
| 1 | 54 |
| 2 | 9 |
| 3 | 4 |
| **4+** | **0** |

This reproduces the 2026-08-25 finding exactly and sharpens how it has been paraphrased since:
13 of 67 active users (19%) reach 2+ days; **zero have ever reached 4**. The genuinely
zero-base metric — where a single positive read is unambiguous — is **4+ distinct active days**.

> **OPEN DECISION, must be resolved before the 2026-09-21 checkpoint.** Change the decider from
> "day-2 return" to "4+ distinct active days"? For: it is the only metric with a true zero base over
> seven months, which is the property the decision rule depends on. Against: it needs ~4 days of
> elapsed engagement per user, so an early-window returner cannot reach it by 09-28, and the 09-28
> date would need a two-tier rule (day-2 as a *lead* indicator worth reading, day-4 as the decider).
> Raised with the planning authority; unanswered at the time of writing. **Do not treat a single
> day-2 return as decisive** until this is resolved.

**C. The active-user denominator holds, and it is what makes 09-28 viable.** Last 7d: **3** distinct
authenticated non-owner users, 13 messages (one user sent 11). Last 30d: **12** distinct users,
60 messages. Anonymous demo messages last 7d: 2. Every active user signed up pre-T_A — there have been
no post-T_A signups. Purchase, trial, Quote Finder and nudge all read off these ~12 returning users
and never needed a new signup; the signup rate was the wrong gate for four of the six rows.

**D. In-app intent rate comfortably clears §9's threshold.** `upgrade_click` at non-marketing sources,
non-owner, distinct users per month: 2026-05 = 10, 06 = 0, 07 = 2, 08 = 6 → **mean 4.5/month** against
the stated "holds unless below ~2/month". The 09-28 decision date stands.

**E. Correction to this session's own reporting.** The claim that the signup rate was "declining" was
over-read: 2 signups in 7 days cannot separate 0.29/day from 0.5/day. The correct statement is
"consistent with the historical ~0.5/day". The substantive consequence — that the original 14-day
window could not reach its stated sample — survives at 0.5/day regardless.

### 9.11 Ruling on §9.10's open decision (2026-09-08, same day, Fable 5.1)

§9.10 records the lead's measurements and leaves one decision open. **Ruling: yes** — the decider moves to
the 4th distinct active day; day-2 becomes a reported rate with null-derived thresholds; the retention-hook
read moves onto data that already exists. The 09-28 date holds (§9.10 D: 4.5 intent users/month against a
~2/month floor). One reported number does not reconcile, and the constant must be fixed before any threshold
is treated as pre-registered.

**Error #4, owned before any post-T_A user has returned.** §9.4's "any non-owner active on a later
calendar day within 7 → read that session, it is the next batch" would have built a batch off the
null: at p ≈ 0.09, one return in a cohort of 10 happens 63% of the time when nothing changed. Retracted;
the §9.3 row and §9.4 bullet are marked in place.

**The reported numbers do not reconcile — resolve before pre-registering a constant.** 16 returners on
the calendar-day definition (18 on the no-cap one) each necessarily have >= 2 distinct active days, yet
the active-days table has only 13 users at 2+. One explanation covers every variant: the script's day-2
CTE (`observation_window.py:150`) anchors "day 1" on `users.created_at`, not on the first message.
A user whose only session happens the day after signup is a "return" with one active day. So 0.094 is a
**signup-anchored** base that mixes delayed first sessions with real returns; the base for "came back
after a session" is at most 13/170 = 0.076 and has not been run. Ask: re-run the day-2 base anchored on
the first user-message day (SQL below), and confirm the active-days table used the same `messages
m.role='user'` via `sessions.user_id` definition. The threshold table below is **provisional at
p = 0.094**; it will be regenerated at the reconciled base, which can only be lower.

**Day-2 is demoted to a reported rate.** *(Regenerated 2026-09-08 at the reconciled base — §9.12; the
provisional 0.094 version is preserved at `45afdb4`.)* Denominator = non-owner users whose **first active
day** is >= T_A **and** <= readout − 7d (exposure; a user first active on 09-26 has not had seven days by
09-28). Base = 10/67 = **0.149** over ever-active users (uncapped lifetime: 13/67 = 0.194). Exposed-active
arrivals ≈ 0.2/day (0.51 signups/day × 0.39 lifetime activation, 67/170 — an estimate applied to new
signups): n ≈ 3 by 09-28, ≈ 6 by 10-12, and n = 30 around **February 2027**. Binomial tail under the base:

| exposed n | P(>= 1 \| 0.149) | returners for tail <= 0.10 | for tail <= 0.05 | expected | uncapped 0.194: k for <= 0.05 |
|---|---|---|---|---|---|
| 3 | 0.38 | 2 | 3 | 0.4 | 3 |
| 5 | 0.55 | 3 | 3 | 0.7 | 4 |
| 7 | 0.68 | 3 | 4 | 1.0 | 4 |
| 10 | 0.80 | 4 | 4 | 1.5 | 5 |
| 15 | 0.91 | 5 | 6 | 2.2 | 7 |
| 20 | 0.96 | 6 | 7 | 3.0 | 8 |
| 30 | 0.99 | 8 | 9 | 4.5 | 11 |

At n = 3 the 0.05 line is 3 of 3; at n = 10, 4 of 10. The day-2 rate is printed for honesty and
**decides nothing in 2026**. Do not decide on it in either direction below ~30 exposed users (§9.13).

**The decider is the 4th distinct active day.** Base over seven months: 0 of 67 ever-active users,
0 of 170 signups. Rules: (1) count **any** non-owner whose 4th distinct user-message day falls >= T_A,
any signup date — the same MAU denominator as the purchase/trial/Quote Finder rows, so it can read
before a new signup could; the 4 users at 3 days are the closest. (2) Report the span from 1st to 4th
day and whether the 4th day is >= T_B: May–May–May–September is a first but not a habit, and says
nothing about B. No window is added, because none was measured. (3) 0/67 is compatible with a true rate
up to ~4.5% (rule of three on active users — a user who never messages cannot reach day 4), so one
day-4 read means "the wall can be crossed; here is who and how", never "B worked". Existence, not
attribution. It is a standing metric with no calendar deadline: report it whenever it moves, including
after 09-28.

**The retention-hook read never needed a future event.** The 16 (or 13, once reconciled) pre-T_A
returners have return-day sessions readable today: same document or a new one, user-message count,
`citation_clicked`, quote events, uploads, and whether any are the paper-writer cohort the 06-12
strategy named as the only multi-week retention (`bas***`/`mel***`/`ric***`/`mca***`). Read-only,
inside §8.4's readout allowance. **Do it before 09-28**, so that if the intent rows are thin the
acquisition decision is taken with the returner profile in hand.

**09-28 rule, restated with the default explicit.** At 12 MAU and 4.5 intent users/month, "no intent
event by 09-28" is ~4% likely; the probable 09-28 state is thin confirmations — a checkout created, a
trial claimed, no Quote Finder search, no day-4 — none of which picks a batch. So: **the 09-28 default
is acquisition (§9.6), unless a thread exists** (§9.13: at ~0.2 exposed-active users/day the day-2 rate cannot decide before 2027 — that arithmetic is itself the argument) — a returner profile from the historical read, a day-4
user, a non-owner Quote Finder search, or a defect. Day-2 above its threshold raises the retention
thread's priority and its sessions are read beside the historical ones, but it selects no batch by
itself; the batch is specified by what returners did. Day-4 >= 1 at any time: read that user's whole
history and decide immediately.

**Script changes (specified, not applied — the candidate is frozen).**
- `:150`: anchor on the first user-message day, not `users.created_at`:
  ```sql
  with days as (
    select s.user_id uid, date(m.created_at) d
    from messages m join sessions s on s.id = m.session_id
    where m.role = 'user' and s.user_id is not null and s.user_id::text <> :owner
    group by 1, 2),
  firsts as (select uid, min(d) first_day from days group by 1)
  select count(*) filter (where exists (select 1 from days x
           where x.uid = f.uid and x.d > f.first_day and x.d <= f.first_day + 7)) returned,
         count(*) exposed
  from firsts f
  where f.first_day >= date(:lo) and f.first_day <= date(:hi);   -- base: lo=2026-02-01, hi=T_A−7d; window: lo=T_A, hi=readout−7d
  ```
  Print `returned / exposed`, the base, and the binomial tail. Delete the `:157-158` "next batch" print.
- Add the day-4 read:
  ```sql
  with days as (/* as above */),
  ranked as (select uid, d, row_number() over (partition by uid order by d) rn,
                    min(d) over (partition by uid) first_day from days)
  select uid, first_day, d as fourth_day, d - first_day as span_days,
         (:tb is not null and d >= date(:tb)) as on_b_code
  from ranked where rn = 4 and d >= date(:ta) order by d;
  ```
- Historical returner read (shape; adapt): for each `(uid, return_day)` from `days` where
  `d > first_day`, join that day's sessions/messages/documents and count documents touched, documents
  created that day, user messages, `citation_clicked` and `quote_*` events, `quote_search` ledger rows,
  and whether any document equals a first-day document.

**Record.** §9 (`9402429`) and §9.10 (`79006c6`) are on `main`; this section is on
`docs/window-ruling-2026-09-08`, rebuilt on `79006c6` (the earlier `86670c6` on the old base is superseded).
`main` has moved past `0f1a1d7` by docs-only commits — `git diff 0f1a1d7 main --name-only` touches `.collab/`
only — so the v0.30.0 candidate's runtime content is unchanged, but §8.1/§9.7's "frozen at `0f1a1d7`" is
now a statement about code, not about the hash: the release record must name the commit actually shipped.

### 9.12 §9.10's base rate was wrong — corrected, and day-4 confirmed at zero

§9.11 caught an internal contradiction in §9.10: 16 returners each necessarily have >= 2 distinct
active days, yet the same section's table showed only 13 users at 2+. The cause is exactly as
diagnosed — the CTE anchored "day 1" on `users.created_at`, so a user whose only session happened the
day after signup counted as a "return" with one active day. That conflates a delayed first session
with an actual return. **§9.10's 0.094 is withdrawn.**

Re-run with one canonical activity relation (`messages.role='user'` joined through `sessions.user_id`,
owner excluded) used identically for every figure below:

| Quantity | Value |
|---|---|
| users with >= 1 active day | 67 |
| users with >= 2 active days | 13 |
| **returned within 7d of their FIRST ACTIVE DAY** | **10** |
| base over the signup cohort (n=170) | **0.059** |
| **base over active users (n=67)** | **0.149** |

§9.11 predicted the reconciled base "can only be lower" and bounded it at <= 13/170 = 0.076; the
measured value is 0.059, below that bound. The 13-vs-10 gap is real and not an error: three users
returned *later* than 7 days after their first active day, so the 7-day cap is itself a modelling
choice, not a natural boundary.

**Which denominator is honest.** Over signups the base is 0.059; over users who ever became active it
is **0.149**. The second is the right denominator for "does a user come back", and it makes day-2 an
even weaker decider than §9.11 assumed — roughly one active user in seven already returns. Any
pre-registered day-2 threshold must be regenerated at 0.149 over the exposed-active denominator, not
at 0.094 and not at 0.059.

**Day-4 confirmed: zero users, ever.** Under the corrected definition, `row_number() = 4` over
distinct active days returns **no rows** across the entire history. 67 users have reached day 1,
13 day 2, 4 day 3, **0 day 4**. The decider named in §9.11 is therefore a true zero-base metric, and
one positive read is unambiguous — with §9.11's caveat intact: 0/67 is compatible with a true rate up
to ~4.5%, so a first day-4 read means "the wall can be crossed, here is who and how", never "B worked".

**The retention hook is readable today — the 13 returners, no future event required:**

| user | active days | msgs | distinct docs | first active |
|---|---|---|---|---|
| 72f99d73 | 3 | 15 | 2 | 2026-04-04 |
| 5c451f94 | 3 | 12 | 1 | 2026-05-02 |
| 558731d6 | 3 | 11 | **0** | 2026-05-18 |
| 040411e1 | 3 | 6 | 5 | 2026-08-21 |
| 0c25a28a | 2 | 15 | 3 | 2026-03-19 |
| 58688124 | 2 | 12 | 1 | 2026-06-17 |
| 5954da3d | 2 | 10 | 1 | 2026-07-26 |
| d3300664 | 2 | 9 | 3 | 2026-04-25 |
| 09508131 | 2 | 8 | 1 | 2026-04-08 |
| 55dde629 | 2 | 6 | 1 | 2026-04-28 |
| c6cce383 | 2 | 6 | 3 | 2026-04-06 |
| 29280f00 | 2 | 5 | 2 | 2026-04-29 |
| 5e03a844 | 2 | 2 | 1 | 2026-08-30 |

Two immediately worth a closer read. **558731d6** reached 3 active days and 11 messages across
**zero distinct documents** — *resolved, and not a defect*: its session carries `document_id = NULL`
with `collection_id = 65237622`, i.e. it is a **collection chat**, which legitimately has no single
document. All 3 authenticated NULL-document sessions in production carry a collection, and 2 of them
hold 15 user messages between them. The finding is therefore about the instrument, not the data:
**a per-document denominator silently hides collection users**, and one of the most engaged multi-day
returners is exactly that. Any B1-style "documents whose first session did X" metric must decide
explicitly whether collection sessions are in or out of its denominator. Second, **040411e1** is the only recent
multi-day returner (first active 2026-08-21) *and* the widest document user here at 5, i.e. the
closest thing production has to a habitual user. Both reads are read-only and inside §8.4's stop-line.

**Process note.** §9.10's error was caught by cross-checking two tables in the same section against
each other, not by re-reading the query. Publishing both tables is what made it falsifiable — the
figures should continue to be reported in a form that can contradict itself.

### 9.13 Ruling on §9.12's open items (2026-09-08, same day, Fable 5.1)

§9.12 corrected the base (0.059 over signups, **0.149** over ever-active users; day-4 = 0 of 67 confirmed)
and asked two things: regenerate §9.11's thresholds and decide the 7-day cap. `9f1f0ed` resolved the
zero-document returner as a collection chat and left one instrument decision open. Rulings:

**1. The regenerated table is in §9.11; its headline is "undecidable in 2026".** Exposed-active users
arrive at ≈ 0.2/day (0.51 signups/day × 0.39 lifetime activation — an estimate, since lifetime
activation is being applied to new signups). That is n ≈ 3 by 09-28, ≈ 6 by 10-12, and n = 30 — the
floor §9.11 set for deciding day-2 in either direction — around **February 2027**. At 0.149 the 0.05 line
is 3 of 3 at n = 3 and 4 of 10 at n = 10. The rate is printed for honesty and decides nothing this year.
That is the strongest single argument yet that acquisition binds learning; it is now in the 09-28 default.

**2. 7-day cap: kept for the rate, uncapped printed beside it.** The cap is what makes a rolling readout
compare equal exposure — without it a user first active on 09-08 and one on 09-20 are not on one scale at
09-28. The three late returners are carried by the uncapped lifetime line (13/67 = 0.194, its own column
in §9.11) and by day-4, which has no cap. One tightening: the base denominator should exclude users whose
first active day is within 7 days of the measurement date (right-censored). At n = 67 that moves the third
decimal; noted, not re-run.

**3. Day-4 at this traffic is a watch on four named users.** New arrivals cannot plausibly reach a 4th
distinct day this quarter (0.2/day through the conditional rates 13/67 → 4/13 → 0/4). The near-term
day-4 read comes from the 4 users already at 3 days — **040411e1** above all (first active 08-21, 5
documents, active this week), then 72f99d73, 5c451f94, 558731d6. The `rn = 4 and d >= T_A` spec in
§9.11 catches them; report the 1st→4th span and whether the 4th day is >= T_B.

**4. Collection sessions — split by level; most numbers are already right.** The canonical relation
(`messages.role='user'` via `sessions.user_id`, no document filter) already includes collection sessions
(`collections.py:365` creates them with `collection_id` and no `document_id`), so 67 / 13 / 10, the
day-2 rate and day-4 are unaffected. Two places need the decision:
- *"distinct docs" in the returner table* — expand collection sessions through `collection_documents`
  (`tables.py:639`, `collection_id → document_id`), with the caveat that membership is current, not
  as-of-message-time:
  ```sql
  with sess_docs as (
    select s.id session_id, coalesce(s.document_id, cd.document_id) document_id
    from sessions s left join collection_documents cd on cd.collection_id = s.collection_id)
  select x.uid, x.d, count(distinct sd.document_id) docs_touched
  from (select s.user_id uid, date(m.created_at) d, m.session_id
        from messages m join sessions s on s.id = m.session_id
        where m.role = 'user' and s.user_id is not null and s.user_id::text <> :owner) x
  join sess_docs sd on sd.session_id = x.session_id
  group by 1, 2;
  ```
- *B1's per-document zero-message rate* (script `:123-126`) — stays document-scoped, because that is
  the surface B1 changed (`DocumentReaderPageClient.tsx:88`), and prints a third line, "documents whose
  only messages came through collection sessions: N", so collection-only documents do not read as
  abandoned. Suggested, not added as a row: post-T_B *activation* (share of signups with >= 1 active day
  within 7d; base 67/170 = 0.39) is a per-user B1 instrument in the same unit as the day-2 rate and
  measures what B1 actually tries to change — weak at this n like everything else, but cleaner.

**5. The returner table has counts, not activities.** Active days / messages / distinct docs does not
answer "what did they return to do". Before 09-28, for each return day of the 13: same document as
day 1 or new; `citation_clicked`; `quote_*` events and `quote_search` ledger rows; Domain Mode
(`feature_trial_usages`, or `sessions.domain_mode` for paid); `paywall_opened` / `upgrade_click`;
uploads that day; document type and page count — **not filenames** (PII; 08-25 masked emails for the
same reason). This is the only near-term source of a retention thread, and the 09-28 default turns on
whether it yields one.

**Record.** §9.12 (`bfc6619`) and the collection resolution (`9f1f0ed`) are on `main`; this section and
the §9.11 regeneration are on `docs/window-ruling-2026-09-08`, rebuilt on `9f1f0ed`. Script changes stay
spec-only: `backend/scripts/` ships in the image through `COPY backend/` even though it is never imported,
so they wait for a post-v0.30.0 branch.

### 9.14 The returner activity read — a retention thread, and the limit nobody targeted

§9.13 item 5 asked what the 13 returners came back to *do*. Read 2026-09-08, read-only, no filenames.

**The modal return is to the SAME document** — 8 of 13; 4 returned with a new document, 1 through a
collection. The hook is "keep working on a document I already have", not "bring a new one".

**They verify constantly and never reach Quote Finder.** Across the 13: **75 `citation_clicked`**,
`rag_verification_completed` on nearly every return day — and **0 saved quotes, 0 `quote_search`**.
This reproduces the 2026-08-25 finding at the individual level: the users who most want source
verification are exactly the ones who never found the feature built for them. C1/C2 shipped for this
population; the window should read whether the chip now reaches them.

**Zero Domain Mode usage** across all 13 (`feature_trial_usages` = 0, `sessions.domain_mode` = 0) —
expected, since all predate A3.

**They express purchase intent and none of it converts:** 16 `upgrade_click`, 6 `paywall_opened`,
0 subscriptions.

#### The single most valuable user story in production: `040411e1`

First active 2026-08-21, 3 active days, the only recent multi-day returner. On 2026-08-28, inside
**113 seconds**:

| Time | Event | Reason / source |
|---|---|---|
| 15:44:05–08 | `limit_hit` ×3 | `session_limit` / `session_dropdown` |
| 15:44:15 | **`upgrade_click`** | `session_limit` → `/billing` |
| 15:45:04 | **`upgrade_click`** | `academic_domain_mode` / `domain_mode_selector` → `/billing` |
| 15:45:21–24 | `limit_hit` ×7 | `session_limit` |
| 15:45:57 | **`upgrade_click`** | `export_pdf` / `chat_plus_menu` → `/billing` |
| 15:46:04 | `export_clicked` | |

**Three distinct upgrade intents from three different features in under two minutes, every one of them
dumped on `/billing`, none converted.** They also own the same 254-page PDF **three times** — the
signature of working around the 3-sessions-per-document cap by re-uploading, which also burns document
slots.

**What this validates, and what it does not:**

1. **A1 would have caught all three clicks.** `session_dropdown`, `domain_mode_selector` and
   `chat_plus_menu` are precisely the in-app sources A1 rewired to `startCheckout`. Pre-A1 all three
   landed on the page whose Subscribe button has never been pressed. This is the concrete mechanism
   behind "zero events = zero clicks", observed in one real user.
2. **A3 directly answers the second click** (`reason=academic_domain_mode`): they were asked to pay
   for a feature they had never been allowed to see.
3. **A4 would NOT have helped them.** Their documents are 0.7 MB / 254 pages — comfortably inside Free.
   A4 addressed a real limit, but not this user's.
4. **The limit that actually blocks the most engaged returner is `session_limit`**
   (`FREE_MAX_SESSIONS_PER_DOC` = 3), which no batch in this programme targeted. Across all non-owner
   users, all time:

   | reason | source | events | users |
   |---|---|---|---|
   | `file_size` | `dashboard_upload_precheck` | 12 | 8 |
   | **`session_limit`** | `session_dropdown` | **10** | **1** |
   | `upload_limit` | `dashboard_upload` | 8 | 6 |
   | `INSUFFICIENT_CREDITS` | `chat_stream` | 1 | 1 |

   `file_size` is the broadest (8 users) and produced the only sale in the product's history;
   `session_limit` is the *deepest* — one user hit it ten times in two minutes and tried to pay three
   times. Breadth and depth point at different limits.

> **OPEN PRODUCT QUESTION for the planning authority.** Is Free = 3 sessions per document the right
> cap? The evidence is one user, so this is explicitly not a mandate — but it is the only limit in
> production observed to produce repeated, immediate, multi-feature purchase intent, and the
> re-uploading workaround suggests the cap is being routed around rather than converting. Raising it
> weakens a paid boundary; leaving it means the highest-intent behaviour we have ever recorded stays
> blocked by a cap that is cheap to hit accidentally. Do not act on n=1 without a ruling.

**What the 09-28 readout should now look for specifically:** a `limit_hit` → `upgrade_click` →
`checkout_created` chain from an in-app source. That is this exact user story with A1 in place, and it
is the narrowest, highest-information event the window can produce.

### 9.15 Ruling on §9.14's open product question — the session cap (2026-09-08, Fable 5.1)

§9.14 asks whether Free = 3 sessions per document is right, and whether one user can move a pricing
boundary. Rulings, with the code facts they turn on.

**What the cap actually is (verified at source).**
- It counts *open* conversations, not lifetime ones: `count(sessions where document_id = X) >= 3`
  (`chat.py:236-241`), and `delete_session` is a hard delete (`chat.py:702`), so deleting a conversation
  frees a slot. Plus and Pro are unlimited (`:236` gates on `plan == "free"`).
- It is **not** a visit cap: on open the reader reuses the latest session when one exists
  (`useChatSession.ts:138-146`) and creates one only when none does (`:155`). Returning to a document
  consumes nothing.
- It **does** count empty conversations: "New chat" creates the row on click, before any message
  (`SessionDropdown.tsx:69`), the first open creates one, and nothing prunes empty user sessions (the
  nightly beat prunes empty *demo* sessions only). Two "reset" clicks without sending reach the cap with
  the document's total at 0–2 messages.
- The copy at the cap (`errorCopy.ts:378-385`, `en.json:2368`) is "Free plan is limited to 3 chat
  sessions per document. Upgrade for unlimited." — the free exit is never mentioned, although the delete
  control renders on every non-active row of the same dropdown (`SessionDropdown.tsx:335-340`).
  `limit_hit` fires once per failed click (`:101`): ten hits = ten presses on a wall whose only
  signposted exit was `/billing`.
- `FREE_MAX_DOCUMENTS = 3` (`config.py:150`): three copies of one PDF is the entire free quota.

**1. Can one user move the boundary? No** — consistent with every n = 1 ruling above. One user is
enough to establish that a *defect* exists; a *boundary* moves on a conversion rate measured at a door
that opens. This door opened on 09-07 (A1: `session_dropdown` now calls `startCheckout`,
`SessionDropdown.tsx:181-190`). The cap's conversion has never once been observed; its first
observation is the chain in item 6.

**2. The number 3 stays; what it counts is conditional on one query.** *(Both readings below are WITHDRAWN — §9.16: the cap fired on a demo document via `chat.py:257-264`, not on a returner's own document. Re-ruled in §9.18.)* 040411e1 has **6 user messages**
across 3 days and 5 documents. Three sessions on one 254-page PDF with that little chat means the capped
sessions were near-empty. The lead's next query (per-session user-message counts on the capped document)
decides which of two readings holds:
- *The three sessions carried real work* (≥ 3 user messages each): the cap is a depth paywall placed on
  the retention hook itself — the modal return is to the same document, so a 4th conversation on it *is*
  a returner. That is where a freemium wall belongs (a readable unit, hit at proven value; 08-25 found
  Free otherwise has no wall). Keep it, fix the signage (item 3), measure conversion at the door.
- *They were empty or one-message* (the likelier reading at 6 messages total): the cap counts the wrong
  unit — the user hit "3 rows", not "3 conversations". The fix is counting, not pricing: count only
  sessions with ≥ 1 user message (a join on `messages` at `chat.py:238-240`; empty rows cost nothing, so
  excluding them weakens no boundary), or reuse the latest empty session on "New chat". That dissolves the
  question for this user without touching the boundary for one who works in three real threads.

**3. The copy is a defect, decidable at n = 1 — and shipping it confounds the chain.** Honest copy
states the cap and both exits: "Free keeps 3 open conversations per document. Delete one to start
another, or upgrade for unlimited." with [Delete a conversation] beside [Upgrade]. It will lower
`upgrade_click@session_limit`, the numerator of the highest-information read the window can produce.
Ruling: **ship it in the first frontend push after v0.30.0, record T_copy, split the chain pre/post.**
A paywall that converts only by hiding the free exit is not the paywall worth measuring; the honest-copy
version is the real test, and any pre-T_copy chain is the dishonest-copy baseline. Not v0.30.0 — the
candidate is frozen — and it is 11 locales.

**4. The workaround inference needs two facts before it hardens.** (a) `created_at` and `status` of the
three copies against the 15:44–15:46 hits on 08-28: after, and all `ready` → workaround confirmed, at
the cost of three parses and the whole free quota; before, or any `error` → B2-class (parse looked stuck,
the user re-uploaded) and the slot-burning story is wrong. (b) If confirmed: same-user content-hash dedup
on upload is a cost guardrail, not a pricing change — backend, not now, registered for the post-09-28
batch.

**5. The cap's denominator is not 170.** "One user in seven months" reads as rare; the honest denominator
is users who ever reached 3 sessions on one document. Ask: distinct (user, document) pairs with >= 3
sessions; how many of those users then hit `limit_hit reason=session_limit`; and the share of all user
sessions with 0 user messages (how common session churn is). If the cap binds a third of everyone who
reaches depth 3, it is not rare — it is selective for the engaged, which is the opposite of rare.

**6. 09-28 readout additions (spec-only, per §9.8).**
- Named row **"Purchase — by limit"**: per user, `limit_hit(reason, source)` → `upgrade_click(source,
  reason)` within 10 min → `checkout_attempts` row → `checkout_created` → `checkout_completed`, grouped
  by `reason`, split pre/post T_copy once it exists. This is §9.14's chain; `file_size` (broad) against
  `session_limit` (deep) is the "which limit converts" read.
- The day-4 read reports whether the user was ever capped (`limit_hit reason=session_limit`): for a
  same-document returner, the day-4 wall and the session cap are the same moment.
- Quote Finder: among post-T_A `citation_clicked` users, any `quote_finder_chip_clicked` /
  `quote_finder_panel_opened`? §9.14's 75 clicks / 0 searches says this population verifies by
  *clicking*, and C1's trigger is query *phrasing* (`action_planner.py`), which a click never fires. If
  the answer is 0 with clicks > 0, the next C item is "Quote Finder from the citation popover" —
  registered for 09-28, not designed now.

**7. What would move the number 3:** a rate, not a user — `session_limit` chains with
`checkout_created >= 1` and `checkout_completed = 0` across >= 3 distinct users under honest copy, or the
depth-3 denominator (item 5) showing the cap binds most users who reach it while none convert. At one
capped user per seven months that may be a year away, which is itself the answer: the actionable items
are the copy and the counting unit, and both are defects, not prices.

**Record.** §9.14 (`e7d850e`) is on `main`; this section is on `docs/window-ruling-2026-09-08`, rebuilt
on `e7d850e`.

### 9.16 §9.14's workaround claim is WRONG — the cap fired on a demo document

§9.15 asked for per-session message counts on 040411e1's capped document. Running it overturned my
own causal story, and §9.15's ruling was partly reasoned on that story, so this correction comes first.

**§9.14 claimed** the user "owns the same 254-page PDF three times — the signature of working around
the 3-sessions-per-document cap by re-uploading". **That is wrong on both halves.**

- The document the cap fired on, `0a29054e`, is **a demo document** — `demo_slug='court-filing'`,
  `user_id` NULL, 6 pages. Not the user's PDF, and not owned by them.
- The user's five sessions are on **five different documents**, one each. They never had three
  sessions on one document of their own.
- The three 254-page copies were uploaded **2026-08-21 18:35, 08-21 18:53 and 08-28 15:46** — two of
  them a week before the limit hits, and the third *after* them. All three are `ready`. So they are
  not cap workarounds. (Three `ready` copies of one 254-page PDF consuming the entire
  `FREE_MAX_DOCUMENTS = 3` quota is still a real observation; its cause is unexplained and is not this.)

**Which branch fired, verified at source.** `chat.py:236` guards the non-demo cap with
`not doc.demo_slug`; `chat.py:257-264` is the demo branch and is correctly scoped to
`ChatSession.user_id == user.id`. `0a29054e` carries a `demo_slug`, so the **demo** cap fired: the
user had reached 3 of their own conversations on the court-filing demo. It now shows 1 session for
them (deletions are hard, `chat.py:702`), which is consistent with the ten `limit_hit` presses.

**The corrected story is not weaker — it is a sharper ICP signal.** A prospective user evaluating the
product on the **legal** demo hit a free wall after three conversations, clicked upgrade three times
from three different features in 113 seconds, was dumped on `/billing` each time, converted none — and
then still went on to upload their own 254-page PDF. That is a high-intent legal prospect the product
failed to convert at the exact moment of intent, which is precisely what A1 rewires. Everything §9.14
said about A1/A3 catching those three clicks stands; only the "re-upload workaround" mechanism is
withdrawn.

**A latent defect found on the way, not live.** The non-demo branch counts **all** sessions on a
document with no user filter:

```python
select(func.count(ChatSession.id)).where(ChatSession.document_id == document_id)   # chat.py:238-240
```

For a private document only the owner has sessions, so it is currently equivalent. But any feature
that lets a second user open sessions on someone else's non-demo document would let their sessions
consume the owner's cap. The demo branch already does it correctly. Worth fixing when that surface
appears; not a live bug today, and NOT in scope now.

**§9.15's three queries, answered:**

| Question | Answer |
|---|---|
| Were the capped sessions empty? | Unanswerable — the capped demo sessions were hard-deleted. Of what remains, the user has **6 user messages across 5 sessions** (~1 each). |
| Cap's real denominator | Only **2** (user, document) pairs have ever reached 3+ sessions, neither of them this user; exactly **1** user has ever hit `session_limit`. The cap is rare, not selective-for-the-engaged. |
| Empty-session prevalence | **22 of 115** authenticated non-owner sessions (19%) carry zero user messages. §9.15's concern that the cap counts rows rather than conversations is real at ~1 in 5. |

**Consequence for §9.15's ruling.** Its two candidate fixes were "depth paywall on the retention hook"
versus "counts the wrong unit". Neither is now supported as stated: the cap did not fire on a
returner's own document, so it is not sitting on the retention hook; and it fired on the demo surface,
where the count is already per-user and correct. What survives is (a) the **copy** defect — still real,
still n=1-decidable, and it applies to the demo wall too — and (b) the 19% empty-session rate as an
independent argument for counting conversations rather than rows, wherever the cap applies. The number
3 stays, for the reason §9.15 gave and one more: it has bound exactly one user, once.

**Process note.** This is the second time in two days that publishing the underlying rows let a wrong
claim be caught — §9.10 by an internal contradiction, §9.14 by a follow-up query someone else asked
for. Both were mine. The tables should keep being published in a form that can contradict the prose.

### 9.17 The verification population is real, well-identified, and has 0% overlap with Quote Finder

§9.15 registered this read to decide the next C item. Run 2026-09-08, all time, non-owner.

| | |
|---|---|
| users who ever clicked a citation | **19** |
| total citation clicks | **163** |
| ...who ever opened the Quote Finder panel | **0** |
| ...who ever clicked the Quote Finder chip | **0** |
| ...who ever ran a `quote_search` | **0** |
| ...who ever saved a quote | **0** |

`quote_finder_chip_clicked` and `quote_finder_panel_opened` have **zero rows ever** (they were only
allowlisted by C2 on 09-07, so absence before that is expected and this is a baseline, not a result).
`quote_search` ledger rows across all users including the owner: **2**.

The top citation clickers are the deepest users in production:

| user | citation clicks | active days |
|---|---|---|
| 040411e1 | 44 | 3 |
| 558731d6 | 31 | 3 |
| 4d660a71 | 20 | 1 |
| 4b44c184 | 13 | 1 |

The two deepest returners in §9.14's table are the two heaviest citation clickers. **The population
Quote Finder was built for is real, is 19 people, is identifiable by name, and has never once reached
the feature.**

**§9.15's hypothesis is supported and now has a number.** This population verifies by *clicking a
citation*; C1's hint fires on query *phrasing*. A click never produces a phrase, so C1 — correct as it
is — cannot reach the behaviour these 19 users actually exhibit. The candidate next C item is therefore
**an entry point on the citation popover itself**, where the behaviour already is, rather than a
better phrase trigger. Registered for the 09-28 decision, not designed now: the honest test of C1 is
whether any post-T_A citation-clicker fires the chip, and that has had one day and zero signups to run.

**Caveat kept explicit:** 0/19 is the pre-C1 baseline. C1 and C2 shipped 09-07; the chip has had no
opportunity yet. This section establishes the denominator the 09-28 read is measured against, and
must not be cited as evidence that C1 failed.

### 9.18 Re-ruling after §9.16/§9.17 — the cap fired on the demo, and that changes the fix (2026-09-08, Fable 5.1)

§9.16 withdrew §9.14's workaround claim: the `session_limit` hits on 08-28 were on the **demo** document
`court-filing` (per-user demo branch, `chat.py:257-264`), the three 254-page copies predate or postdate
the hits and are all `ready`, and 040411e1 never had three sessions on a document of their own. §9.15's
two candidate readings both rested on that premise and are marked withdrawn in place. What follows
replaces them.

**1. The number 3 stays, now on three grounds.** n = 1 moves no boundary (§9.15.1); the door only opened
09-07; and §9.16's denominators say the own-document cap has essentially never bound — 2 (user, document)
pairs ever reached 3 sessions, 1 user ever hit `session_limit`, and that one hit was on the demo.

**2. The counting unit: reuse, do not exclude.** §9.15's primary fix — count only sessions with >= 1 user
message — is **withdrawn as unsafe**. The per-user demo cap exists to close the row-spam DoS on the
anonymous cap (`rules/backend.md`, Demo System), and an own-document cap that ignores empty rows is
unbounded row creation by the same token. §9.16's 22 of 115 (19%) empty authenticated sessions is a
real churn signal, but the safe shape is the alternative §9.15 listed second: **"New chat" reuses the
current session when it carries zero user messages** (clear the pane, create no row). That removes the
churn without loosening either cap. Frontend-only (`SessionDropdown.tsx:69` guards on the live
transcript). Post-v0.30.0.

**3. The copy is two defects, not one.** Both branches raise the identical `SESSION_LIMIT_REACHED`
(`chat.py:245`, `:268`) and the frontend renders one string for both (`errorCopy.ts:378-385`): "Free plan
is limited to 3 chat sessions per document. Upgrade for unlimited."
- *Own document*: state both exits — delete one (the control renders in the same dropdown,
  `SessionDropdown.tsx:335-340`) or upgrade. As §9.15.3, with T_copy recorded and the chain split.
- *Demo document*: the string is wrong in kind. An anti-abuse guard on a sample document is presented as a
  Free-plan limit with an upsell, and post-A1 that upsell is a Stripe Checkout page for someone who has
  not uploaded anything. The honest copy is "The demo allows 3 conversations per sample document —
  upload your own document to keep going", CTA = upload (a signed-in Free user has 3 document slots), not
  upgrade. The reader already knows the surface (`useDocumentLoader.ts:97` sets `isDemo`), so this is a
  client-side branch on existing state. Frontend-only, post-v0.30.0, 11 locales.

**4. 040411e1, reframed.** The three intents in 113 seconds were **evaluation on the legal demo**
(`session_limit` on `court-filing`, `academic_domain_mode` on the same surface, `export_pdf`), not depth
on their own work. Their own documents: five, one session each, six messages in total. The demo held them
for three conversations; their own uploads held them for about one message each. That asymmetry is B1's
hypothesis in one user — the demo page has hard-coded suggested questions, their own first sessions had an
empty pane — and is recorded here as a hypothesis the 09-28 B1 read touches, not as a finding. It also
means the "most engaged returner" label in §9.14 should read "widest uploader"; the two deepest returners
by citation clicks (44 and 31, §9.17) are the engagement to read.

**5. Chain spec amendment.** The "Purchase — by limit" row (§9.15.6) groups additionally by whether the
document the limit fired on is a demo (`documents.demo_slug is not null`): demo-surface intent is
evaluation intent and must not be pooled with depth intent. Same split on `upgrade_click` by
`source=domain_mode_selector`.

**6. §9.16's latent defect — recorded, agreed out of scope.** The own-document branch counts all sessions
on the document with no user filter (`chat.py:238-240`); equivalent today because only the owner has
sessions on a private document, wrong the day any shared-document surface exists. It joins the
post-09-28 hardening list beside the content-hash dedup that §9.16 made moot.

**7. Quote Finder — §9.17 is the baseline, and the candidate is the popover.** 19 non-owner citation
clickers, 163 clicks, 0 panel opens / chip clicks / searches / saves, with the two deepest returners at
the top. The lead's caveat stands and is binding: this is the **pre-C1 baseline**, not a C1 result. The
09-28 read is post-T_A `citation_clicked` users against chip/panel events. If that reads 0 with clicks
> 0, C1's phrasing trigger does not reach the population that verifies by clicking, and the next C item
is an entry point on the citation popover itself. Registered; not designed before 09-28.

**Record.** §9.16 (`031b412`) and §9.17 (`ae3f89b`) are on `main`; this section is on
`docs/window-ruling-2026-09-08`, rebuilt on `ae3f89b`. Nothing in it is code under the stop-line;
everything blocked remains blocked on the owner.

### 9.19 Verified: the demo session wall now sends non-uploaders to Stripe. Live since 09-07.

§9.18 item 3 argued the demo branch's copy is "wrong in kind". Verified at source — it is worse than a
copy problem, and it is **live in production today**:

1. `chat.py:245` (own-document) and `chat.py:268` (demo) raise the **identical** `SESSION_LIMIT_REACHED`.
2. `errorCopy.ts:378-385` renders one string for both: *"Free plan is limited to {limit} chat sessions
   per document. Upgrade for unlimited"*, with `cta: upgradeCta(tOr, 'session_limit', 'plus')`.
3. `SessionDropdown.tsx:182-193` `onUpgrade` calls `startPlanAwareBillingAction({ currentPlan: profile?.plan })`.
4. `billing.ts:33-35`: `if (currentPlan === 'free') return { kind: 'checkout' }` — **straight to Stripe.**
5. `SessionDropdown.tsx` has **no `isDemo` branch on this path.** It cannot tell a sample document from
   the user's own.

**So a signed-in free user who reaches 3 conversations on a demo document is told they have hit a
"Free plan" limit and is taken directly to a Stripe Checkout page — having uploaded nothing.** The cap
they actually hit is the per-user anti-abuse guard on sample documents
(`rules/backend.md`, Demo System), not a product limit on their own work. The honest next action is
"upload your own document" — a signed-in free user has 3 slots — and that is not offered.

**A1 did not create the mis-framing; it sharpened the consequence.** Pre-A1 this dumped the user on
`/billing`, which was inert. Post-A1 it is a payment page. This is the one place where A1's fix lands
on a surface where asking for money is the wrong move.

**This is exactly the path 040411e1 walked on 2026-08-28** (§9.16): `session_limit` on the
`court-filing` demo → `upgrade_click` → `/billing`. The same user today would land on Stripe.

**It is also the path the 09-28 window is most likely to actually observe**, because demo traffic is
the traffic. A `checkout_created` arriving from `source=session_dropdown, reason=session_limit` on a
demo document must NOT be read as "the purchase wall fell" — it is an evaluation-stage user pushed to
a payment page by a guard. §9.18 item 5's demo/own split in the "Purchase — by limit" row is therefore
not a refinement; without it the headline metric is corrupted by this defect.

**Not fixed now, by ruling** (§9.18: frontend-only, post-v0.30.0, 11 locales, Codex-reviewed). It is
not money loss and not a security issue; it is a wrong-in-kind upsell. Recorded here so that (a) it is
not rediscovered as a surprise, and (b) the owner knows before running the §5 proofs that hitting the
demo session wall today leads to Stripe.

**Also amended per §9.18 item 4:** §9.14 called `040411e1` the "most engaged returner". That is
withdrawn — they are the **widest uploader** (5 documents, but 6 user messages total, ~1 per session).
The engagement to read is the citation clicking (44 and 31 by the top two, §9.17). Their asymmetry —
three conversations held by a demo with hard-coded suggested questions, about one message each on
their own uploads with an empty pane — is B1's hypothesis visible in one user, and is recorded as a
hypothesis the 09-28 B1 read touches, not as a finding.

### 9.20 v0.30.0 shipped — T_B recorded

**T_B = 2026-09-09T09:27:27.985Z** (Railway backend deployment SUCCESS). Deployed backend-first per
`.claude/skills/deploy/SKILL.md`; the owner authorized it, as they did v0.29.0.

| Step | Evidence |
|---|---|
| Gates on the candidate (`31e75ae`) | ruff clean · sole head `20260826_0043` · 956 passed / 3 skipped · 52 integration · build compiles · 22 frontend unit · version check 0.30.0 |
| No new migration | `git diff 8e93934 stable` touches no `alembic/versions/` — B carries none, so rollback to v0.29.0 is a plain redeploy |
| Backend live | `/health` = 0.30.0, **confirmed twice ≥30 s apart** per the cutover-sampling rule |
| In-container | `alembic current` = `20260826_0043 (head)`; `RAILWAY_REPLICA_REGION` = `us-west2` |
| Frontend pushed after | `8e93934..31e75ae` → `stable`, Vercel rebuilt (chunk hash rolled, release marker "without the monthly cap" served) |
| Smoke | `/`, `/demo`, `/pricing`, `/use-cases/lawyers`, `/trust` all 200 |

Tag `v0.30.0` = `31e75ae`. The shipped commit is `31e75ae`, not `0f1a1d7`: the runtime content is
identical (every commit between them is `.collab/` only), but the release record names what shipped.

**Window state.** `[T_A, T_B)` = 2026-09-07T00:22:30Z → 2026-09-09T09:27:27Z was the A+C-only window
and recorded **zero non-owner signups**, so it reads nothing, exactly as §9 predicted. From T_B the
full A+B+C surface is live. Attribution stays per metric, not per deploy.

**Both live defects recorded before the window runs**, so neither is mistaken for a signal later:
§9.19's demo session wall routing non-uploaders to Stripe (unfixed by ruling, frontend-only,
post-v0.30.0), and §9.18's own-document copy hiding the free delete exit. A `checkout_created` from
`session_dropdown / session_limit` on a demo document is an artefact of the first, not a purchase-wall
result.

### 9.21 The session-limit batch was split — item 4 is dropped, not deferred

Branch `fix/session-limit-copy-only` @ `f486f1e` (off `main` = `a0a446f`) carries items 1–3 and is
review-clean. The item-4 work is preserved on `wip/session-reuse-r3` @ `a37068c`. Both are pushed.

**What shipped in the branch:** the demo session wall stops routing non-uploaders to Stripe (§9.19's
live defect) and offers upload instead; the own-document wall names both exits and shows
[Delete a conversation] beside [Upgrade]; `limit_hit` carries `document_id`/`is_demo` so the 09-28
demo/own split does not depend on the current route.

**What was dropped: item 4** — "New chat" reusing an empty session. Not deferred; dropped as a
frontend item.

#### Why it was dropped — the value was measured, not argued

Production, all time, authenticated non-owner sessions:

| | first-open row | via "New chat" |
|---|---|---|
| has user messages | 89 | 2 |
| **empty** | **14** | **7** |

Item 4 can only touch the "empty via New chat" cell: **7 rows in seven months**, about one a month.
The other 14 empties are first-open auto-creates (`useChatSession.ts:160` creates a row on every first
open) — those are a B1 retention signal (open, look, leave), not churn, and no client change can
remove them. The residual fix is extending the existing empty-demo-session prune
(`cleanup_tasks.py:46-52`, which already covers authenticated empty demo sessions) to own-document
empties: backend, one filter, a different batch.

#### The bug class this batch exposed — worth not repeating

Two adversarial rounds produced two BLOCKs with the **same** shape, both mine:

- r1: an ownership guard (`messagesSessionId === sessionId`) added to decide "is this session empty"
  also gated session switching. A failed initial restore never restored ownership, so every later
  session click and New Chat returned early **forever** — enabled-looking, inert until reload.
- r2: the restore-in-flight token that replaced it blocked the post-delete replacement, leaving the
  active session pointing at a **deleted** conversation whose transcript then installed.

Both were demonstrated with executed base-vs-HEAD reproductions, not argument.

**The rule:** never gate a user action on a condition that clears only when an async request settles.
`frontend/src/lib/api.ts` has no request timeout, so "settles" is not guaranteed — a hung request
turns the gate into a dead control. Late-response **drops** are the safe class: they discard a stale
result and never block an action. This is why Codex's "disable deletion while a restore is pending"
option was rejected — it would have cured the class with the class.

The fault was in the *oracle*, not the feature: the live transcript is not a safe emptiness signal
during a restore. If item 4 is ever revived, the oracle with no async coupling is the sessions list's
server-reported `message_count === 0` **and** no local user message — the second conjunct is required,
because the client only increments `message_count` on stream `done`, so a failed send leaves it 0
while a user message is visible.

#### Amendment to §9.18 item 2 (authored by Fable 5.1, corrected by Fable 5.1)

§9.18 specified the reuse fix as "frontend-only, guard on the live transcript". That was wrong, and is
withdrawn: r1 and r2 proved the live transcript is not a safe emptiness oracle during restore.
§9.18's related assumption in §9.19 — that the demo/own copy branch was "a client-side branch on
existing state" — was also wrong: `SessionDropdown` takes no props and reads only the store, while
`isDemo` was local state in `useDocumentLoader`, so it had to be plumbed through the store first.

#### One accepted regression, declared before review

Reverting `onSwitchSession` to base restores base's **absence** of a late-response guard, so the
A→B→A switch clobber window returns. This is a return to the accepted status quo, not a new defect —
it predates the batch and has been in production for months. It was declared at the top of the r3
review brief so it would not be filed as a regression (the framing `b718493` used for Batch C). The
guard is preserved on `wip/session-reuse-r3` if it is ever wanted.

#### Review outcome

r3 returned **SHIP** with all five acceptance checks PASS, verified byte-level (SHA-256 on
`useChatSession.ts`, AST-extracted declaration comparison for `onSwitchSession` /
`onDeleteSessionById`). `useChatStream.ts`, `demoSessionStorage.ts` and `useChatSession.ts` are all
zero-diff against base, so the demo counter contract is intact by construction rather than by
argument.

Its one NOTE was fixed anyway (`f486f1e`): within four lines the catch used the validated request
snapshot for `limit_hit` but a live store re-read for the copy, so on a return to the same document
before its metadata landed a **demo** cap rendered own-document copy with a working Upgrade button —
§9.19's defect surviving in a transition window. Graded NOTE rather than BLOCK because base does the
same, but it is the exact defect class the batch exists to remove and the fix adds no machinery.

#### Not yet done

Not deployed. Shipping items 1–3 needs an owner-authorized `stable` push; **T_copy must be recorded
at that deploy** (§9.15.3) because the honest copy will lower `upgrade_click@session_limit`, the
numerator of the "Purchase — by limit" row.

#### Confirmed for the acquisition branch

`/tools` has **zero inbound navigational links**. The only references outside the tools section are a
route definition (`app/[locale]/tools/page.tsx:6`) and a locale-routing entry (`i18n/routing.ts:63`);
the Footer links `/compare` but not `/tools`. §9.6's item stands as written.

### 9.22 Acquisition item (a) scoped at source — and an EN defect found on the way

§9.6/§9.18 authorised a frontend-only acquisition branch, item (a) being locale structured data.
Scoped 2026-09-10 before writing any code. Three things changed the shape of the work.

**1. The gap is 31 pages, not 33 — and lawyers is already correct.** Of the 32 locale pages built by
`marketingLocalePage` (Article-only), **31** have an EN twin that emits richer schema
(FAQPage / HowTo / SoftwareApplication / BreadcrumbList): all of `alternatives/*`, `compare/*`,
`features/*`, `use-cases/*` except lawyers, plus `/demo`, `/pricing`, `/tools`, `/trust`.
**31 paths × 10 locales = 310 URLs** currently under-marked.

`/use-cases/lawyers` is NOT one of them and is not a gap — it is the **proven pattern**. It has a
dedicated `LawyersJsonLd` component that both the EN route and the locale route mount, and it is
fully locale-aware: FAQ resolved from the same translation keys the visible FAQ uses,
`localizedHrefIfAvailable` URLs, `inLanguage: locale`. Its docstring states the reason — Google flags
content/markup mismatches. It is the only such component in the app.

**2. The fix cannot be "copy the EN schema to the locales".** Every other EN page **hardcodes English
strings** inside its JSON-LD (`question: 'Can DocTalk summarize a research paper?'`) while the visible
FAQ renders from translation keys. So the schema must be **rebuilt from the translation keys**, the
way `LawyersJsonLd` does. Copying would emit English markup on a Japanese page — worse than the
current generic Article.

**3. There are THREE FAQ key conventions**, which a single generic helper must handle or be told:

| Convention | Example | Seen on |
|---|---|---|
| `<pre>.faq.q<n>.question` / `.answer` | `useCasesFinance.faq.q1.question` | finance, teachers, lawyers |
| `<pre>.faq.q<n>` / `.a<n>` | `useCasesStudents.faq.q1` / `.a1` | students, compare/chatpdf |
| `<pre>.faq<n>Question` / `faq<n>Answer` | `compareHumata.faq1Question`, `altsChatpdf.faq1Question` | compare/humata, alternatives/* |

Inferring the convention is fragile; the per-page FAQ items should be resolved by the page and passed
in, not guessed by the helper.

#### EN defect found while scoping — verified

`/use-cases/finance` emits a FAQPage question that **does not appear on the page**:

- JSON-LD: *"Can **AI** summarize financial statement footnotes from 10-K filings?"*
- Rendered: *"Can **DocTalk** summarize financial statement footnotes from 10-K filings?"*

That is a content/markup mismatch on a live English page — the exact failure `LawyersJsonLd` was
written to avoid, and a direct consequence of hardcoding schema separately from the rendered copy.
Rebuilding every page's schema from its translation keys fixes this class permanently rather than
patching the one instance.

*Method note:* two earlier passes appeared to show drift on `use-cases/students`, `compare/chatpdf`,
`compare/humata` and `alternatives/chatpdf`. Those were **my key-prefix lookups being wrong**, not
code defects — each resolved to zero rendered questions because I guessed the wrong convention. Only
`use-cases/finance`, where both sides resolved (6 hardcoded, 6 rendered), is a real finding. Recorded
because a wrong finding published as fact is worse than no finding.

### 9.23 Session-limit copy fixes are LIVE — T_copy recorded

**T_copy = 2026-09-10T10:46:35Z** (Vercel production deployment of `1bc208d`).

Frontend-only deploy: `git push origin stable`, **no `railway up` and no version bump**.
`backend/app/core/version.py:18-37` loads `version.json` from the *container*, so bumping it
without redeploying the backend would make `/health` report a version that is not running.
`version.json` stays at 0.30.0 and `/health` remains truthful. The only non-frontend file in the
diff is `backend/scripts/observation_window.py`, a standalone local analysis script the application
never imports, so the running image needs no rebuild.

**What is now true in production:** a signed-in free user who reaches 3 conversations on a *sample*
document is told "The demo allows 3 conversations per sample document. Upload your own document to
keep going" and is offered **upload**, not Stripe. §9.19's live defect is closed. On their own
documents the wall now names both exits — delete a conversation, or upgrade — instead of only
upgrading, and `limit_hit` carries `document_id`/`is_demo` so the 09-28 demo/own split works off
any route.

Verified live: the release-specific string is present in the served bundle (cache-busted request —
the site HTML is edge-cached and a plain `curl` shows the previous build for minutes), and
`/`, `/demo`, `/pricing`, `/use-cases/lawyers`, `/trust` all return 200.

**Consequence for the 09-28 read, as §9.15.3 anticipated:** honest copy will *lower*
`upgrade_click@session_limit`, which is the numerator of the "Purchase — by limit" row. That row
must be split pre/post T_copy. A drop is the fix working, not the funnel worsening.
