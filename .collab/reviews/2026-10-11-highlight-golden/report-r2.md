# Citation highlight, all formats: browser acceptance, round 2

Date: 2026-10-11. Release candidate: `3df77e01` (branch `release/highlight-all-formats-2`), run from a detached worktree on an isolated local stack, production build (`next build` + `next start`). Nothing was pushed, merged or deployed. Evidence: `evidence-r2/` next to this file. Round 1: `report.md`.

## Environment incident: read this first

**The shared docker Postgres stopped serving in the middle of the run. The owner must check it before anyone trusts the `doctalk` dev DB.**

- The host disk filled up. `df` showed 118 MiB free on `/System/Volumes/Data` (460 GiB, 429 GiB used) when the first `ENOSPC` hit my tool calls.
- My scratch footprint at that time was about 3 GB: the release worktree with `node_modules` and `.next` (2.1 GB), a Python venv (326 MB), and headless Chrome profiles (about 550 MB).
- I deleted four stale Chrome profiles that I had created and that no process used (about 384 MB). Free space then rose to 3.2 GiB; other processes also released space.
- The backend log (`r2-backend.log`, scratch) then shows two hits of this error, then only connection timeouts:
  `asyncpg.exceptions.PostgresIOError: could not open file "global/pg_filenode.map": Input/output error`
- `global/pg_filenode.map` belongs to the whole cluster, not to one database. The `doctalk` dev DB, `doctalk_golden` and every other DB in the `doctalk-postgres` container share it.
- The last good write was the document brief for the uploaded TXT at 16:15:08 local time. The first failed request (`GET /api/credits/balance`, 500) came right after the jump `r2-e-kiln-m1-c1b`.
- At 16:23 and 16:28: `docker ps` and `docker exec` hang. The Docker socket `/_ping` times out (`curl` exit 28). Postgres on 5432 accepts TCP, but a `psycopg` connect times out after 16 s. Qdrant (6333) and MinIO (9000) answer 200. Redis (6379) accepts TCP.
- I did not restart Docker Desktop, any container or Postgres. Those are not my processes, and other projects use the same daemon.

**Owner actions:**
1. Free disk space on the host.
2. Restart Docker Desktop.
3. Read the `doctalk-postgres` container log for the I/O errors.
4. Verify the `doctalk` dev DB before you use it: connect, count rows in the main tables, and run `pg_amcheck` if the log shows write failures.

**Effect on this review.** Items c, d and f and part of e need the database, so I could not run them. I mark them "blocked", not "fail". The browser work that ran before the incident is complete and is reported below.

## Conclusion

**The fixes that I could test work. 0 wrong marks. 0 frames with a label stronger than the marks. P2-1 is fixed (7 of 7 now marked). TXT now uses the evidence path, renders literal text safely and keeps right-to-left order.**

**I cannot give a ship verdict yet.** P2-2 (Quote Finder card and `?highlight=`), P2-3 (deep-link scroll) and the DOCX default view were not run in the browser because of the incident. Run c, d and f again after Docker is back. That is about 30 minutes of work on the same stack.

I found no new highlight defect.

## Results, a to h

| Item | Result | Evidence |
|---|---|---|
| a. Full citation set | **Pass.** 0 wrong marks. 0 of 284 recorded frames show a label stronger than the marks (115 recorded jumps). On the 47 round-1 citations: 42 correct, 5 weaker label, 0 support unmarked, 0 wrong (round 1: 33 / 2 / 7 + 4 TXT / 0). | `evidence-r2/timeline-check-r2.txt`, `timelines-r2.txt` |
| b. P2-1, the 7 unmarked sentences | **Pass.** 7 of 7 are now marked, on the same stored citations as round 1. | `r2-md1-m2-c1`, `r2-md1-m4-c1`, `r2-md2b-m1-c1`, `r2-docx2-m1-c2`, `r2-docx2-m2-c1`, `r2-xlsx-m2-c1` (`-final.jpg`) |
| c. P2-2, Quote Finder card jumps in 5 formats + `?page=2&highlight=<pp. 1–4 chunk>` | **Blocked** (Postgres down). Not run. | — |
| d. P2-3, `hl-link-single` and `/d/<docx>?page=5` scroll on `next start` | **Blocked** (Postgres down). Not run. | — |
| e. TXT | **Pass for what ran.** English and Arabic both use the evidence path, with a status line that matches the marks. Literal `#`, `*`, `**`, `&amp;`, `<b>` and `<script>` render as text, with no injected element. Arabic stays right to left. The 5 round-1 TXT questions, asked again: support marked in 5 of 5. Restored-session clicks on the round-1 TXT sessions: blocked. | `r2-e-kiln-m1-c1-*`, `r2L-txt-m1-c1`, `r2L-txt-m2-c2`, `r2L-artxt-m1-c1`, `r2L-artxt-m2-c1` |
| f. DOCX default view in every entry path | **Blocked in the browser.** Code check passes (see below). Not verified on screen. | `frontend/src/lib/readerView.ts`, `tests/reader-default-view.test.cjs` |
| g. PDF | **Pass.** No regression. Same labels and boxes as round 1. | `r2L-pdf-m1-c1`, `r2L-pdf-m2-c3` |
| h. Golden path + session switch | **Pass.** Upload through the dashboard file input → parse → chat → citation jump to page 2, "Exact passage". The session menu switch loads the old session with no stale mark or label. A switch during streaming: blocked. | `r2-h-upload-0`, `r2-h-upload-ready`, `r2-e-kiln-m1-c1-final`, `r2-h-session-menu`, `r2-h-session-switched` |

## a. The 47 round-1 citations

I clicked the same 32 MD, DOCX, PPTX and XLSX citations again in their round-1 sessions (restored). For URL, PDF and TXT I could only ask the round-1 questions again in new sessions (live), because the database stopped before I reached their old sessions.

| Format | n | Correct | Weaker label | Support unmarked | Wrong | Round 1 (C / W / U / X) |
|---|---|---|---|---|---|---|
| MD | 14 | 14 | 0 | 0 | 0 | 10 / 0 / 4 / 0 |
| DOCX, text view | 9 | 7 | 2 | 0 | 0 | 5 / 2 / 2 / 0 |
| PPTX, text view | 5 | 4 | 1 | 0 | 0 | 5 / 0 / 0 / 0 |
| XLSX | 4 | 2 | 2 | 0 | 0 | 3 / 0 / 1 / 0 |
| URL (live re-ask) | 6 | 6 | 0 | 0 | 0 | 6 / 0 / 0 / 0 |
| PDF (live re-ask) | 4 | 4 | 0 | 0 | 0 | 4 / 0 / 0 / 0 |
| TXT en + ar (live re-ask) | 5 | 5 | 0 | 0 | 0 | old path, 4 of 5 unmarked |
| **Total** | **47** | **42** | **5** | **0** | **0** | 33 / 2 / 7 + 4 TXT / 0 |

The 5 weaker labels:
- **`docx1-q1-c2`, `docx1-q1-c3`: unchanged from round 1.** Same marks, same "Related passage". On a closer look the claim is "All analyses followed the intention-to-treat principle." That sentence occurs twice in the fixture (pages 1 and 2). The uniqueness rule refuses to mark it, which is the correct result.
- **`pptx-q2-c4`, `xlsx-q1-c3`, `xlsx-q1-c4`: Exact in round 1, Related on restore.** This is the known P3 from round 1: stored citations lose the refined `focus_snippet`. The same questions asked live give "Exact passage" for all three (`r2L-pptx-m2-c4`, `r2L-xlsx-m1-c3`, `r2L-xlsx-m1-c4`). So this is not a downgrade in `3df77e01`.
- Measured on live clicks only, the 47 give 44 correct and 2 weaker.

**The full live set.** I asked every round-1 question again in a new session for all 10 documents and clicked every pill: 69 jumps, 34 Exact and 35 Related, 0 wrong. The supporting text is marked in every jump except the 4 `docx1` pills on the duplicated intention-to-treat sentence (see above). The randomisation sentence in the same answer is marked.

## b. P2-1 in detail

| Round-1 citation | Round-2 jump (same stored citation) | Now marked |
|---|---|---|
| md1-q2-c1, md1-q2-c2 | r2-md1-m2-c1, r2-md1-m2-c2 | "Use `--strict` mode *only* when the probe is calibrated & dry." (region) |
| md1-q4-c1 | r2-md1-m4-c1 | "شملت الدراسة ثمانية وثلاثين موقعا من الأراضي الرطبة." (region, in view) |
| mob-md-c1 | r2-md2b-m1-c1 | "Seal counts happen at low water…" (region; near the bottom of the pane at desktop width) |
| docx2-q1-c2 | r2-docx2-m1-c2 | "Every inbound pallet is scanned at bay three…" (region) |
| docx2-q2-c1 | r2-docx2-m2-c1 | The Night row (22:00, 06:00, 9) (region) |
| xlsx-q2-c1 | r2-xlsx-m2-c1 | The Software row (region; live re-ask: Exact) |

Residual, by design: a sentence at the very start of a chunk that is glued to an unverified heading stays unmarked ("This manual describes…" after "Purpose and scope" in the depot DOCX). The anchor of `md1-q4-c1` still scrolls to the start of the region (English, page 1), but the Arabic mark is in view.

## e. TXT in detail

**Fixture.** I wrote a synthetic two-page TXT, `kiln-studio-notes.txt` (5,792 characters). The extractor splits it at 3,000 characters, so the special lines sit on page 2. Page 2 holds these lines as stored text:

```
# This line starts with a hash and is not a heading.
*Asterisks stay literal* and so does **double emphasis**.
The supplier is written as Clay &amp; Glaze Ltd in the order book.
<b>This is not bold</b> and <script>alert("kiln")</script> must stay plain text.
```

**Result** (`r2-e-kiln-m1-c1`):
- Status "Citation 1 · Page 2 · Exact passage". Marks: 1 exact on the supplier sentence, 3 regions. The label matches the marks.
- The page body is `<pre dir="auto">` with `white-space: pre-wrap`. Its only child elements are the 4 `<mark>` elements.
- All six literal strings are present in `textContent`: `# This line`, `**double emphasis**`, `Clay &amp; Glaze` (the five characters, not decoded), `<b>This is not bold</b>`, `<script>alert("kiln")</script>`.
- The document has 0 injected `script`, `b`, `h1`–`h3`, `em` or `strong` elements with this text. No dialog opened.
- The anchor was in view on page 2 (`top` 482). The pane scrolled to `scrollTop` 819.

**The round-1 TXT cases, asked again live:**

| Round 1 | Round 2 | Status | Supporting text |
|---|---|---|---|
| txt1-q1-c1 (title + "Week o") | r2L-txt-m1-c1 | Related | "Repairs to the landing stage took nine days…" marked |
| txt1-q2-c1 | r2L-txt-m2-c1 | Related | the inspector and rain-tank sentences marked |
| txt1-q2-c2 | r2L-txt-m2-c2 | Related | "He praised the clean brasswork but criticised…" marked |
| artxt-q1-c1 (title + first sentence) | r2L-artxt-m1-c1 | Exact | "حضر هذه الجلسات أكثر من تسعمائة طفل خلال العام الماضي." |
| artxt-q2-c1 (wrong sentence) | r2L-artxt-m2-c1 | Related | both digital-lab sentences inside the region |

Arabic stays right to left: right-aligned lines, correct reading order, and the exact mark sits on its own characters (`r2L-artxt-m1-c1-final.jpg`). The Related labels in the TXT rows are honest: the live focus for those citations was empty.

## f. DOCX default view: code check only

- `defaultReaderView(fileType)` returns `text` for `docx` and `slide` for every other type (`frontend/src/lib/readerView.ts:14`).
- The reader derives its view in one place: `DocumentReaderPageClient.tsx:118`, `readerView(viewChoice, documentId, fileType)`. A toggle choice is stored with its `documentId`, so it does not carry over to another document.
- The chat pill, a `?highlight=` link, the collection reader and a Quote Finder jump all render this component. So the rule should hold in every entry path. I did not see it on screen.
- `node --test tests/reader-default-view.test.cjs tests/text-viewer-txt.test.cjs`: 13 of 13 pass.
- Caution: in my live runs both DOCX files opened in text view. That proves nothing, because LibreOffice is not installed, so these files have no converted PDF and only the text view exists. A real check needs a document with a converted PDF.

## g. PDF

| Jump | Status | Boxes |
|---|---|---|
| r2L-pdf-m1-c1, BLEU | Page 8, Related | region |
| r2L-pdf-m1-c2, BLEU (new pill) | Page 1, Related | region (abstract) |
| r2L-pdf-m2-c1, heads | Page 5, Exact | 1 line box |
| r2L-pdf-m2-c2 | Page 4, Related | region |
| r2L-pdf-m2-c3, multi-head | Page 5, Exact | 2 line boxes |

This matches round 1. Caveat from round 1, still true: the per-frame recorder counts PDF page wrappers, not region boxes. I checked the boxes from the final state only.

## Console (production build)

- 0 React errors or warnings.
- 13 errors, all after the incident: 11 × 504 and 2 × 500 from the backend. The first was logged at the jump `r2-e-kiln-m1-c1b`.
- Info only: CSP report-only notices (inline script; the local MinIO URL; the direct upload to `localhost:8001`). These come from the local setup.
- Full list: `evidence-r2/console-summary-r2.txt`.

## P3 observations (no action needed for this release)

- **Restored sessions lose the refined focus** (unchanged from round 1). Three round-1 Exact citations show Related when the session is reopened.
- **A sentence that occurs twice is never marked** (`docx1`, intention-to-treat). This is the uniqueness rule working as designed.
- **Pills that share a number jump to the first citation with that number** (unchanged). In the TXT test, the pill on the cobalt claim shows the supplier sentence as the exact mark. The cobalt sentence is inside a region mark.
- **Wide exact marks.** `r2-pptx-m2-c2` (restored) marks the whole regional table plus the operating-costs sentence as exact. `r2L-url-m2-c4` includes the heading "Notes:". These follow the backend's focus.
- **Exact marks on a meta answer.** For the off-topic URL question, `r2L-url-m1-c3` and `r2L-url-m1-c4` are Exact on table-of-contents lines and on an indentation sentence. The claim is "the sections I reviewed cover…". The marks match the focus and the label is honest. The backend picked a weak focus.

## What to run after Docker is back

1. c: one Quote Finder search-card jump each in MD, DOCX, PPTX, XLSX and URL, plus a saved-quote jump, plus `/d/f1c73c97-2c9b-4808-89e8-82e064ed2284?page=2&highlight=81ac4977-ebe6-404c-830d-025dbbbe7e09`.
2. d: three runs each of `/d/f1c73c97-2c9b-4808-89e8-82e064ed2284?page=5&highlight=c03a6a6d-d6e9-4752-bce1-b0683176bdcf` and `?page=5`, on `next start`. Record `scrollTop`, the mark position and the page header position. Add one wheel event during the jump.
3. f: give one DOCX and one PPTX a converted PDF (scratch DB only), then record the selected view for each entry path and for a PPTX → DOCX switch.
4. e: the 5 round-1 TXT citations in their restored sessions.
5. h: open the session menu during a streaming answer.

## Method

Stack, all local, all started by me from the detached worktree of `3df77e01`:

| Part | Setup |
|---|---|
| Backend | :8001 |
| Celery worker | solo pool, Redis db 9 |
| Frontend | `next build` + `next start` on :3000 |
| Data | scratch DB `doctalk_golden`, MinIO bucket `doctalk-golden`, Qdrant collection `doctalk_golden` |
| Browser | my own headless Chrome over the DevTools Protocol (not the desktop browser pane) |

- Not touched: the stale :8000 backend, the `doctalk` DB, the Supabase stack, the desktop browser pane, any docker container.
- Fixtures: synthetic or public only. New in round 2: `kiln-studio-notes.txt` (synthetic).
- LLM calls used the local `.env` keys. The local test user's credentials are in a scratch file outside the repo.
- Left in place: `doctalk_golden`, the bucket, the Qdrant collection, Redis db 9 and the docker volumes.

## Round 2b (8927e588)

Date: 2026-10-11. Release candidate: `8927e588` = `3df77e01` + `be7bdd4f`, `67cf5ec7`, `8927e588` (frontend only: `textEvidence.ts`, `textJump.ts`, `TextViewer.tsx`, tests, docs). I ran it from a detached worktree with `npm ci --prefer-offline`, `next build` and `next start`, on the same isolated stack and `doctalk_golden` as round 2. Nothing was pushed, merged or deployed. Evidence: the `r2b-*`, `r2bL-*` and `*-r2b.txt` files in `evidence-r2/`.

Disk (`df -h /System/Volumes/Data`): 22 GiB free before the build, 16 GiB after it, 23 GiB at the end of the browser work.

### Conclusion

**All five items pass. 0 wrong marks. 0 frames with a label stronger than the marks. P2-2 and P2-3 are fixed. I found no new defect and no blocker in the browser for `8927e588`.**

One limit: the document-switch part of i passes, but in this build the reader pane remounts on a document switch. So my test may not reach the code path that the fix guards. I did not run a pre-fix build for comparison.

### Results

| Item | Result | Evidence |
|---|---|---|
| c. P2-2: Quote Finder card jumps + multi-page `?highlight=` link | **Pass.** MD, DOCX, PPTX, XLSX and URL all show "Exact passage". In all five the exact mark is the card's quote. The region marks are the rest of the card's chunk. The multi-page link shows "Related passage" with 1 region on page 2, in view. Round 1: DOCX card and the link were page only. | `r2b-c-<fmt>-cards.jpg`, `r2b-c-<fmt>-j1-final.jpg`, `r2b-c-hl-multi-b-final.jpg`, `timelines-r2b.txt` |
| d. P2-3 on `next start`: `hl-link-single` and `/d/<docx>?page=5` | **Pass.** `hl-link-single`, 3 of 3: the mark is in view at 522–541 ms and `scrollTop` settles at 302 at 681–747 ms. `?page=5`, 3 of 3: the page 5 header is in view and `scrollTop` settles at 253 at 635–641 ms. Round 1: `scrollTop` 78 with the mark out of view, and page 5 never shown. | `r2b-d-hl-single-1-final.jpg`, `r2b-d-page5-1-final.jpg`, `r2b-d-hl-single-wheel-final.jpg`, `timelines-r2b.txt` |
| f. DOCX view toggle | **Not testable locally: the toggle does not render.** It needs a converted PDF, and no local DOCX or PPTX has one (LibreOffice is not installed). Only the text view exists. | `DocumentReaderPageClient.tsx:187` |
| i. Pending jump (56a1d73e) | **Pass in all three cases.** A single click while the bodies mount still scrolls to its mark. Of two clicks, only the second scrolls. After a switch to document B, B does not scroll and shows no status or mark. Limit: see the Conclusion. | `r2b-i-single-2-final.jpg`, `r2b-i-double-1-final.jpg`, `r2b-i-switch-1-final.jpg`, `r2b-i-switch-2-md-final.jpg`, `timelines-r2b.txt` |
| j. Regression: full live citation set, per-frame gate | **Pass.** 66 jumps over 10 documents: 33 Exact, 33 Related. 0 wrong marks over 488 marks. 0 of 169 frames with a label stronger than the marks. | `markcheck-r2b.txt`, `timeline-check-r2b.txt`, `r2bL-*-final.jpg` |

### c. Quote Finder cards in detail

I ran one Quote Finder search per format and clicked "Jump to page" on the first card.

| Format | Card (page) | Status | Exact mark | Region marks |
|---|---|---|---|---|
| MD | p. 1 | Exact | "Water samples were taken at dawn to limit the effect of daily temperature swings." | the Site/pH table cells and the `--strict` line |
| DOCX | p. 2 | Exact | "A delivery that arrives without a signed temperature log is held in quarantine cage B…" | the other three sentences of page 2 |
| PPTX | p. 3 | Exact | "Operating costs fell for the third consecutive quarter." | "Quarterly review" |
| XLSX | p. 2 | Exact | 6 cells: Team, People, Research, 12, Support, 7 | none |
| URL | p. 3 | Exact | "Unless the entire docstring fits on a line, place the closing quotes on a line by themselves." | 4 nearby pieces of the same chunk (one is a code block) |

- The DOCX row is the round-1 P2-2 case. Round 1 showed page only.
- XLSX: the card's quote is the pipe table `| Team | People | … | Support | 7 |`. The exact marks are its 6 cells. The pipes are not marked. So the mark is the card's quote, cell by cell.
- Every card shows "Highlight location is approximate". This is the card's own label for chunk-level boxes.
- Multi-page link `/d/<depot>?page=2&highlight=81ac4977…` (a pp. 1–4 chunk): "Citation 1 · Page 2 · Related passage", 1 region ("Every inbound pallet…" paragraph). `?page=2` narrows the chunk to page 2, so only page 2 is marked. The pane scrolls from 0 to 70 by 529 ms and the mark is in view.

### d. Deep-link scroll in detail

All times are `performance.now()` in the page after navigation. The pane spans 147–891 px (98–891 px without the status bar).

| Run | Label shown | First scroll | Mark in view | Settled `scrollTop` | Final mark top | Final page 5 header top |
|---|---|---|---|---|---|---|
| hl-link-single 1 | 113 ms, Related | 419 ms | 522 ms | 302 at 729 ms | 766 (in view) | 706 (in view) |
| hl-link-single 2 | 115 ms, Related | 424 ms | 527 ms | 302 at 681 ms | 766 (in view) | 706 (in view) |
| hl-link-single 3 | 131 ms, Related | 489 ms | 541 ms | 302 at 747 ms | 766 (in view) | 706 (in view) |
| `?page=5` 1 | no label (none expected) | 428 ms | — | 253 at 635 ms | — | 706 (in view) |
| `?page=5` 2 | no label | 432 ms | — | 253 at 641 ms | — | 706 (in view) |
| `?page=5` 3 | no label | 429 ms | — | 253 at 635 ms | — | 706 (in view) |

- Page 5 is the last page, so 302 and 253 are also the maximum `scrollTop`. That alone does not prove that the scroll targets the mark. Two other runs show that it does: the multi-page link (c) stops at 70 on page 2 in the same pane, and the double click in i stops at 46 on page 2. Both are mid-document.
- With a wheel event at about 200 ms (`r2b-d-hl-single-wheel`), the pane moves only by the wheel (95 → 98) and the programmatic scroll does not run. The mark ends out of view (top 970). This is the designed cancel (`cancelPendingAnchor`), not a lost jump.
- The 3 screenshots of each run set are byte-identical. I kept run 1 of each.

### f. View toggle

`showViewToggle = hasConvertedPdf && fileType !== 'pdf'` (`DocumentReaderPageClient.tsx:187`). `converted_storage_key` is null for `depot-manual.docx`, `highlight-fixture.docx` and `highlight-fixture.pptx`. So no toggle renders and no view is "selected". Only the text view exists.

### i. Pending jump in detail

**Method.** The brief suggested a network or CPU throttle. Latency alone did not work: the chat also lazy-loads react-markdown, so the source chips and the page-body spinners never existed at the same time. Instead I held the react-markdown chunk at the network layer (DevTools `Fetch` domain, HTTP cache off), so document A's 5 page bodies stay spinners while its source chips (outside Markdown) can be clicked. Then I released the chunk. The event log shows 5 body spinners at every click. A = `depot-manual.docx`, B = `coastal-handbook.md`, both 5 pages; `switch-2-md` reverses them. The switch is a client-side `router.push` (the app router from the React tree).

| Run | Events (ms) | Result |
|---|---|---|
| single-2 | click Page 5 at 129 (5 spinners); release at 440 | Exact on page 5, mark in view at 580, `scrollTop` 302 at 753. No lost jump. |
| double-1 | click Page 5 at 132; click Page 2 at 444; release at 762 | "Page 2 · Exact" on "Cold-chain items must reach…", `scrollTop` 46. No move toward page 5 in the next 4 s. |
| switch-1 | click A Page 5 at 129; switch to B at 437; B's pages are spinners at 504; release at 1056 | B stays at `scrollTop` 0 of 278. No status, no mark. |
| switchfast-1 | click at 129; switch at 441; release at 497 | B stays at 0. No status, no mark. |
| switch-2-md | click MD A Page 5 at 128; switch to DOCX B at 438; release at 1007 | B stays at 0 of 253. No status, no mark. |

- `single-1` ran with a cached chunk (the bodies were already mounting). It also scrolled to its mark. It is extra evidence only.
- **Limit.** After `router.push`, the reader pane is a different DOM element: the pane remounts. A pending jump in A's TextViewer can therefore end with the unmount, not with the new document check. So this path may not have exercised the bug that `8927e588` fixes. I did not build the pre-fix commit to compare. A unit test or a same-instance switch would be a stronger proof.
- Before release, the status line said "Locating source…", the honest loading label.

### j. Full live citation set

I asked every round-1 question again, in a new session for each of the 10 documents, and clicked every pill (one per pill number).

**Wrong marks: 0.** I checked each jump against its own citation. A pill renders the citation at the same position in its answer's final citation list (`citations_refined` replaces the stream's citations when present). All 66 jumps matched their own citation. Every one of 488 marks lies inside that citation's chunk text (scratch DB). Every exact mark lies inside that citation's `focus_snippet`. PDF boxes I checked from the final state (round-1 caveat: the recorder counts page wrappers).

**Label stronger than marks: 0.** The gate ran over three sets:

| Set | Records | Frames | Violations |
|---|---|---|---|
| All round-2b records (calibration runs included) | 90 | 331 | 0 |
| Results (last record per label) | 86 | 292 | 0 |
| Live j (`r2bL-*`) | 66 | 169 | 0 |

**Per document, compared with the round-2 live set** (Exact / Related):

| Doc | Round 2 (3df77e01) | Round 2b (8927e588) | Why it differs |
|---|---|---|---|
| md1 | 4 / 5 | 4 / 5 | — |
| md2 | 4 / 3 | 7 / 3 | the answers had more pills |
| docx1 | 0 / 4 | 0 / 4 | — (the intention-to-treat sentence occurs twice; by design) |
| docx2 | 8 / 2 | 8 / 2 | — |
| pptx | 3 / 6 | 3 / 3 | fewer pills; the 3 Related citations had an empty focus |
| xlsx | 4 / 2 | 0 / 3 | every xlsx citation had an empty focus this time (round 2: `\| Support \| 7 \|`, `\| Software \| 4300 \| 4300 \|`) |
| txt | 0 / 3 | 0 / 3 | — |
| artxt | 1 / 3 | 1 / 3 | — |
| pdf | 2 / 3 | 2 / 3 | same pages, same boxes |
| url | 8 / 4 | 8 / 4 | — |
| **Total** | **34 / 35 (69)** | **33 / 33 (66)** | |

- The backend did not change between the two candidates. The Exact-to-Related changes in xlsx and pptx follow from the backend's focus, not from the frontend: a citation without a focus can only be Related. The XLSX table path still gives Exact when a focus exists (the c card).
- 14 Related jumps had a non-empty focus: 8 where the focus runs across a table and the next block or a heading (md1 ×4, md2 ×3, docx2 ×1), 1 with the Arabic summary glued to its heading (md1-m4), 3 on the duplicated docx1 sentence and 2 PDF citations. These documents have the same Related counts as in round 2. I did not compare each focus with round 2 one by one.
- One gate frame has a status that is not an app label: in the first link run (`r2b-c-hl-multi`) my probe read a `<style>` element. I fixed the probe; `r2b-c-hl-multi-b` is the result.

### Console (round 2b)

- 0 errors and 0 warnings in 308 messages, all on `next start`.
- Info only: CSP report-only notices (inline script, the local MinIO URL). They come from the local setup.
- The backend log has no 4xx or 5xx response. Every new session returned 201.
- Full list: `evidence-r2/console-summary-r2b.txt`.

### Still not run

These items from "What to run after Docker is back" were not in the round-2b brief:
1. e: the 5 round-1 TXT citations in their restored sessions.
2. h: the session menu during a streaming answer.
3. A saved-quote (Evidence Board) jump.

### Method changes in round 2b

- The candidate ran from its own detached worktree. Backend, worker and `next start` all ran from it.
- New probes: deep-link timing (`linkprobe`), Quote Finder search and card jump (`qfsearch`), and a 25 ms pane recorder that survives a client-side document switch.
- `timelines-r2b.txt` has every recorded run. A label recorded twice is marked: the earlier block is a calibration run (the probe read the wrong scroller or page header, or the race did not overlap). The later block is the result.
- The local test user and its credentials are unchanged and stay in a scratch file outside the repo.
