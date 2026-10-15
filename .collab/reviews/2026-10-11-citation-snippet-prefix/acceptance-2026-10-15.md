# Browser acceptance: citation snippet without the section-title prefix (2026-10-15)

Candidate: `fix/citation-snippet-prefix` @ 133779e7 (Codex r3 = SHIP). Production build (`next build` + `next start`), run by Claude in the desktop browser pane. Nothing was pushed, merged or deployed.

## Result

**8 checks pass. 0 wrong marks. Two plan items could not run locally; they move to the production checks or stay unit-tested.**

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Native PDF, citation stored before the change (prefixed snippet) | Pass. "Citation 1 · Page 8 · Related passage", margin region on the cited block. | screenshot in session |
| 2 | Native PDF, new citation on the same chunk | Pass. Same label and region as check 1 (strategy 1 unchanged). Stored payload: `text_snippet` starts "In addition, we apply dropout…", `section_title` = "GNMT + RL [38]" as its own field. | DB row, screenshot |
| 3 | Citation card | Pass. New card: "In addition, we apply dropout…"; old card keeps "GNMT + RL [38]: In addition…". | DOM text |
| 4 | Share dialog preview | Pass. "[1] · p. 8 — In addition, we apply dropout to the sums…", no heading prefix. | screenshot |
| 5 | Public shared page (`/shared/<token>`, local) | Pass. `[1] p. 8: "In addition, we apply dropout to the sums of the embeddings…"`. | page text |
| 6 | Backend Markdown export of the session | Pass. New footnotes quote chunk text; the five older footnotes keep their stored prefixed text, as designed. | `export?format=md` |
| 7 | Missing-file PDF (object removed from local MinIO after a backup, restored afterwards) | Pass. Old prefixed citation: jumps to page 8, no highlight (same as main: the legacy `": "` retry was dropped after Codex r1 #4). New citation: amber highlight on "In addition, we apply dropout to the sums of the embeddings and t…", the correct passage (the end inside a word comes from the old prefix-shortening matcher, unchanged). | DOM + screenshot |
| 8 | DOCX text view (strategy 4), new citation | Pass. "Citation 2 · Page 2 · Exact passage", exact mark on "Damaged cartons are photographed…". DOCX chunks have no `section_title` (headings are glued), so the payload has no new field there. | DOM |

Console: two errors, both expected: 410 `FILE_MISSING` during check 7 and one 404 from a mistyped document URL. No React errors.

## Not run, and why

- **Brief source-ref jump in PPTX slide view (strategy 3, the one input this change alters):** no LibreOffice on this Mac, so no converted PDF. Moves to production check 5 (as for 0.36.1's PPTX item).
- **Summary citation:** the local DB has no summary-mode citations (348 citations, all `text`), and the test questions did not trigger map-reduce retrieval. Covered by `backend/tests/test_citation_snippet_shape.py` (no `section_title` on summary hits) and `frontend/tests/citation-state.test.cjs` (store sets no `highlightSnippet`).
- **Continuation that mixes old and new citations at one offset:** needs a truncated answer; covered by the shared fixture `backend/tests/fixtures/export_citations.json` (run by both the frontend and backend suites).

## Setup

- Stack on localhost from the release worktree: backend :8001, Celery solo worker (Redis db 9), frontend :3000.
- Data: scratch DB `doctalk_golden`, MinIO bucket `doctalk-golden`, Qdrant collection `doctalk_golden` (left from the 10-11 highlight acceptance, with 28 stored prefixed citations on `attention-paper.pdf`).
- Auth: a session cookie minted for the local test user with a fresh `AUTH_SECRET`/`ADAPTER_SECRET` generated for this run; the repo `.env` secrets were not used by the frontend.
- LLM calls used the local `.env` keys (DeepSeek Flash, three questions).
- Not touched: the `doctalk` dev DB, other projects' containers, production.

## Environment note

The host disk fell to 338 MiB free during the run (other processes were writing about 1 GB/hour; `~/.codex/tmp/dashboard-vm-recovery-20261011*` held about 91 GB). I deleted only my own `.next` build output and paused; the owner freed space. Afterwards the Docker daemon API stopped answering (`/_ping` timed out), as on 2026-10-11, while Postgres kept serving on 5432 (both `doctalk` and `doctalk_golden` answered, no I/O errors in the backend or worker logs). I did not restart Docker. Queries after that went over TCP, not `docker exec`.
