# Citation highlight, all formats: browser acceptance test

Date: 2026-10-11. Branch tested: `release/highlight-all-formats` at `4e4ee459` (origin/stable + 18 commits), on an isolated local stack. Nothing was pushed, merged or deployed. Evidence: `evidence/` on branch `review/highlight-golden` (commit `90148745`).

## Conclusion

**Do not ship `4e4ee459` as it is. Hold it for one owner decision about the DOCX default view (P2-4). The highlight logic itself is safe to ship.**

- **P1: none.** No click marked the wrong passage. No frame showed a status label stronger than the marks on screen. I checked this on 166 recorded frames over 68 recorded jumps.
- **P2: five findings.** All five are missing marks or open scope questions. None is a wrong mark.
- **The blocking item is P2-4.**
  - The code opens every DOCX in slide view: `DocumentReaderPageClient.tsx:51`, `useState<'slide' | 'text'>('slide')`.
  - The production image installs `libreoffice-writer`, so production DOCX files have a converted PDF and open in slide view.
  - This branch's own docs (`ac8426ef`) say DOCX slide view "opens the wrong page" and "the text view is the accurate DOCX path".
  - The brief says the owner decided on text view as the DOCX default.
  - The fix is one line. This is a short hold, not a rework.
- The other four P2s can ship as follow-ups. They make the feature weaker, never wrong.

## Numbers

| Format | Unique chat citations | Correct | Weaker label | Support unmarked | WRONG |
|---|---|---|---|---|---|
| MD (2 docs, en/zh/ar) | 14 | 10 | 0 | 4 | 0 |
| DOCX, text view (2 docs) | 9 | 5 | 2 | 2 | 0 |
| PPTX, text view | 5 | 5 | 0 | 0 | 0 |
| XLSX | 4 | 3 | 0 | 1 | 0 |
| URL (PEP 257) | 6 | 6 | 0 | 0 | 0 |
| PDF (seed paper) | 4 | 4 | 0 | 0 | 0 |
| TXT, en + ar (old path, no status line) | 5 | n/a | n/a | 4 of 5 | 0 |
| **Total** | **47** | **33** | **2** | **7, plus 4 TXT** | **0** |

Other jumps:
- Quote Finder: 1 search-card jump (P2-2) and 1 saved-quote jump (correct).
- Deep links: 2 (P2-2 and P2-3).
- Repeat clicks: 19. These were at 375 px, under `next dev`, around the hide toggle, or on pills that share a number.

Total: 70 jumps.

"Support unmarked" is a fourth category, outside the brief's three-way scheme. The label is honest ("Related passage") and the marks are inside the cited chunk. But the one sentence the answer relies on has no mark.

Measured against the plan's §6 acceptance bar:
- Wrong-passage highlights: 0.
- Status truthful: 100%.
- Marks on the cited chunk: every chat citation in MD, DOCX, PPTX, XLSX and URL.
- Marks on the exact sentence the answer relies on:

| Format | Marked | Rate |
|---|---|---|
| MD | 10 of 14 | 71% |
| DOCX | 7 of 9 | 78% |
| XLSX | 3 of 4 | 75% |
| PPTX | 5 of 5 | 100% |
| URL | 6 of 6 | 100% |

On this strict reading, MD, DOCX and XLSX fall just under 4/5. I wrote my own questions; the plan's five fixed questions per format were not used.

## Findings

### P1: none

### P2-1: The sentence after a heading, or the last table row before one, is not marked (MD, DOCX, XLSX)

The label stays "Related passage", which is honest. The region marks cover other sentences of the chunk. 7 of 34 MD/DOCX/XLSX citations were affected:

| Citation | Unmarked supporting text |
|---|---|
| md1-q2-c1, md1-q2-c2 | The `--strict` line. It is glued to the CJK heading that follows it. |
| md1-q4-c1 | The first sentence of the Arabic summary. The anchor also scrolled to English text on page 1. |
| mob-md-c1 | "Seal counts happen at low water". |
| docx2-q1-c2 | "Every inbound pallet is scanned at bay three". |
| docx2-q2-c1 | The Night row. The Morning and Evening rows are marked. |
| xlsx-q2-c1 | The Software row. |

**Cause.** The code documents this choice in a comment (`textEvidence.ts:84-112`).
- The parse worker glues the heading in front of the first sentence.
- `chunks.section_title` is NULL for these documents (0 of 20 chunks), so `/text-content` serves no title (`documents.py:800-812`).
- Without a title, the code cannot verify the glued heading, so it skips the whole piece: heading plus first sentence.

**Fix options.**
- Store `section_title` for these headings at parse time.
- Or match the page-side part of a glued piece by itself.

Evidence: `md1-q2-c1`, `md1-q4-c1`, `mob-md-c1`, `docx2-q1-c2`, `docx2-q2-c1`, `xlsx-q2-c1` (`-final.jpg`).

### P2-2: A Quote Finder search-card jump marks nothing; the same quote from the Saved tab shows "Exact passage"

- **Search card (`qf-docx2-j1`):** the verified quote "A delivery that arrives without a signed temperature log is held in quarantine cage B…" (p. 2) showed "Page location only" with no mark.
- **Saved tab (`qf-saved-j1`):** the same quote showed "Exact passage", with the mark in view.
- **Deep link (`hl-link-multi`):** `?page=2&highlight=<pp. 1–4 chunk>` gives page only, with no mark.

**Cause.**
1. `citationFromQuoteCard` (`Quotes/utils.ts:15`) sends the real `chunkId`, `page: 2`, and no `contextText`.
2. The fetched chunk is 1,651 characters on pages 1–4.
3. With no `contextText`, the search covers only page 2.
4. Page 2 holds less than 30% of the chunk, so the coverage check (`textEvidence.ts:416`) returns nothing before it tries the quote.
5. The saved quote works by accident: its chunk id is the saved row's id, so the fetch returns 404 and the code falls back to the quote text.

**Fix options.**
- Take the coverage scope from the chunk's own `page_start`/`page_end`.
- Or try a verified quote before the coverage check.

### P2-3: A `?highlight=` deep link marks the passage but does not scroll to it (production build)

| Build | Link | Runs | Result |
|---|---|---|---|
| `next start` | `/d/<depot>?page=5&highlight=c03a6a6d…` | 5 of 5 | "Related passage" with a correct mark, but the pane stays at `scrollTop=78` and the mark is below the window. |
| `next dev` | same | 3 of 3 | Scrolls to the mark. |
| both | `?page=5` with no highlight | 5 of 5 | Never shows page 5. This scroll logic is unchanged on the branch, so it is pre-existing. |

- The collection reader opens exactly this URL (`collections/[collectionId]/page.tsx:246`).
- Chat-pill clicks always scrolled.
- Likely cause: the scroll runs before the lazily loaded Markdown renderer lays out the pages.
- Not determined: whether stable behaves the same.

### P2-4: The DOCX default view is still slide view

See the Conclusion.
- No commit in `origin/stable..HEAD` changes the default.
- Locally, DOCX files opened in text view only because the LibreOffice conversion failed.

Owner decision needed: make text view the default, or confirm slide view and test it first.

### P2-5: TXT (en and ar) still uses the old highlight

The plan intends this ("TXT unchanged"), but the brief expected TXT to be marked. TXT gets no status line and no evidence marks. The highlight is a prefix match of `text_snippet`, often cut mid-word.

| Citation | Highlighted text | Supports the answer? |
|---|---|---|
| txt1-q1-c1 | The log title + "Week o" | No |
| txt1-q2-c1 | "…gallon of o" | Supports a secondary claim |
| txt1-q2-c2 | "He praised … a week of" | Yes, cut before the last word |
| artxt-q1-c1 | The title + the first sentence, cut at "ألف" | No |
| artxt-q2-c1 | A study-hall sentence | No; the answer relies on the digital-lab sentence |

RTL layout is correct. Owner decision needed: keep TXT out of scope, or move it to the new path.

### P3

- **Pills that share a number jump to the first citation with that number.** This is pre-existing: `MessageBubble` uses `find(refIndex)`. PDF pills 3 and 4 do nothing new, and PEP 257 citation 1 backs five bullets.
- **Restored citations lose the refined focus.** Citation rows stored in the DB have no `focus_snippet` from `citations_refined`, because that event exists only in the stream.
- **The Quote Finder jump label says "Citation 1".** The jump came from a quote card, not a chat citation.
- **Every saved-quote jump logs a 404** for `/api/chunks/<saved-quote-id>`, a stand-in id by design.
- **Three console errors during touch taps at 375 px:** "Unable to preventDefault inside passive event listener invocation." It comes from the react-dom chunk, not with mouse clicks, and may be an emulation artefact.
- **The PPTX exact mark includes the slide title** ("Quarterly review Revenue grew…").
- **Two DOCX labels are more cautious than needed:** `docx1-q1-c2/c3` say "Related" although the supporting sentence is marked.
- **One URL exact mark is wider than the claim:** `url-q1-p3` has 4 exact pieces, because the backend's focus is wide.

## The seven checks

1. **Status label timing.** A recorder (MutationObserver + rAF) ran during every jump, with screenshots at 0, 100 and 1000 ms.
   - 166 frames, 0 with a label stronger than the marks.
   - Text view goes from "Locating source…" to the final label in 6–80 ms.
   - PDF shows "Page location only" for 1–4 ms before the final label. That frame is weaker, which is allowed.
   - Caveat: the per-frame recorder does not count PDF region boxes. I checked those from the final state only.
2. **Console.**
   - Production build: no React errors or warnings. Only CSP report-only notices, plus the P3 items above.
   - `next dev`: no "Maximum update depth", hydration or key warnings over 15 jumps in all formats.
   - I proved the capture works with a probe warning and a probe error.
   - "Failed to fetch credits" is a test artefact: I stopped the dev server while the tab was open.
3. **Stale state.** I switched between citations on the same page, between pages, to New Chat, and to another document. No old mark or old label stayed. Hide, the reset after hide, and "Back to answer" all work.
4. **DOCX/PPTX slide view against text view.**
   - Slide view: not tested (no LibreOffice).
   - DOCX text view: 9 citations, 4 Exact and 5 Related. Support marked in 7 of 9; 0 wrong.
   - PPTX text view: 5 of 5 correct, 3 Exact and 2 Related.
5. **PDF bbox.** No regression found.
   - p. 5: exact lines on "…employ h = 8 parallel attention layers, or heads." and on "Multi-head attention allows…".
   - p. 8 and p. 4: region boxes.
6. **Arabic.**
   - TXT renders right to left correctly, with the old highlight.
   - In MD, the first sentence of the Arabic summary is not marked (P2-1).
   - zh MD citations: Exact, 2 of 2.
7. **Mobile at 375 px.** MD (one click, one tap) and DOCX (two taps).
   - The Document pane opened every time, and the anchor was in view.
   - `scrollWidth` = 375 = `innerWidth`, so there was no horizontal overflow.

## Every clicked citation

Every row's full timeline is in `evidence/timelines.txt`. The screenshot is `<ID>-final.jpg` when it was copied.

| # | ID | Fmt | Question | Cit | Page | Status | Marks | Supp | Scroll | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | md1-q1-c1 | MD | pH at Alder Marsh | 1 | 1–3 | Related | 11 region (6.8 row) | yes | yes | OK |
| 2 | md1-q1-c2 | MD | same | 2 | 1–3 | Related | 12 region | yes | yes | OK |
| 3 | md1-q2-c1 | MD | strict mode | 1 | 1–3 | Related | 11 region; strict line unmarked | no | yes | P2-1 |
| 4 | md1-q2-c2 | MD | same | 2 | 1–3 | Related | 12 region; same | no | yes | P2-1 |
| 5 | md1-q3-c1 | MD | zh water samples | 1 | 2 | Exact | 水样均在清晨采集… | yes | yes | OK |
| 6 | md1-q3-c2 | MD | same | 2 | 2 | Exact | same | yes | yes | OK |
| 7 | md1-q4-c1 | MD | ar wetland count | 1 | 1–3 | Related | 12 region; Arabic first sentence unmarked | no | anchor p. 1 | P2-1 |
| 8 | md2-q1-c1 | MD | grey seals | 1 | 4 | Exact | "…214 grey seals…" | yes | yes | OK |
| 9 | md2-q2-c1 | MD | Gull Point, readings | 1 | 1–5 | Related | 18 region | yes | yes | OK |
| 10 | md2-q2-c2 | MD | same | 2 | 2 | Exact | "Readings are taken every thirty minutes…" | yes | yes | OK |
| 11 | md2-q3-c1 | MD | log format, dataset | 1 | 1–5 | Related | 18 region | yes | yes | OK |
| 12 | md2-q3-c2 | MD | same | 2 | 5 | Exact | "…publishes a cleaned dataset…" | yes | yes | OK |
| 13 | mob-md-c1 | MD 375 | seal counts | 1 | 1–5 | Related | 18 region; "Seal counts happen at low water" unmarked | no | yes | P2-1 |
| 14 | mob-md2-tap-c2 | MD 375 tap | same | 2 | 4 | Exact | "…214 grey seals…" | yes | yes | OK |
| 15 | dev-md2-c1 | MD dev | = 13 | 1 | 1–5 | Related | = 13 | no | yes | repeat |
| 16 | dev-md2-c2 | MD dev | = 14 | 2 | 4 | Exact | = 14 | yes | yes | repeat |
| 17 | docx2-q1-c1 | DOCX | cold-chain, scan bay | 1 | 2 | Exact | "Cold-chain items must reach…" | yes | yes | OK |
| 18 | docx2-q1-c2 | DOCX | same | 2 | 1–4 | Related | 16 region; bay-three sentence unmarked | no | yes | P2-1 |
| 19 | docx2-q2-c1 | DOCX | night shift | 1 | 1–4 | Related | 16 region; Night row unmarked | no | yes | P2-1 |
| 20 | docx2-q3-c1 | DOCX | incident reviews | 1 | 5 | Exact | "…37 incident reviews in 2025…" | yes | yes | OK |
| 21 | docx2-q3-c2 | DOCX | same | 2 | 5 | Exact | same | yes | yes | OK |
| 22 | docx2-q3-c4 | DOCX | fridge range | 4 | 3 | Exact | "The refrigerated room is kept between…" | yes | yes | OK |
| 23 | docx1-q1-c1 | DOCX | principle, randomisation | 1 | 1–2 | Related | 8 region | yes | yes | OK |
| 24 | docx1-q1-c2 | DOCX | same | 2 | 2 | Related | 1 region on the support | yes | yes | weak |
| 25 | docx1-q1-c3 | DOCX | same | 3 | 1–2 | Related | 7 region | yes | yes | weak |
| 26–33 | docx1-q1-c6, docx2b-c1/c4, mob-docx-c4/c1, dev-docx2-c0/c7/c2 | DOCX | repeats of 23, 17, 22, 22, 17, 17, 22, 19 | | | same as the original | | | yes | repeat (hide toggle OK) |
| 34 | qf-docx2-j1 | DOCX qf | QF quarantine quote | card | 2 | Page only | none | no | page | P2-2 |
| 35 | qf-saved-j1 | DOCX qf | same, Saved tab | saved | 2 | Exact | the quote | yes | yes | OK |
| 36 | hl-link-single | DOCX link | `?page=5&highlight=c03a6a6d` | — | 5 | Related | correct region | yes | no | P2-3 |
| 37 | hl-link-multi | DOCX link | `?page=2&highlight=81ac4977` | — | 2 | Page only | none | no | page | P2-2 |
| 38 | pptx-q1-c1 | PPTX | revenue, notes | 1 | 1 | Exact | "Quarterly review Revenue grew 14 percent…" | yes | yes | OK (P3 title) |
| 39 | pptx-q1-c2 | PPTX | same | 2 | 1 | Exact | speaker notes | yes | yes | OK |
| 40 | pptx-q2-c1 | PPTX | op costs, North | 1 | 1–3 | Related | 13 region | yes | yes | OK |
| 41 | pptx-q2-c4 | PPTX | same | 4 | 3 | Exact | "Operating costs fell…" | yes | yes | OK |
| 42 | pptx-q2-c3 | PPTX | same | 3 | 2–3 | Related | 11 region | yes | yes | OK |
| 43 | dev-pptx-c0 | PPTX dev | = 38 | | | | | | | repeat |
| 44 | xlsx-q1-c1 | XLSX | Travel Q2, Support | 1 | 1–2 | Related | 7 region, Travel row | yes | yes | OK |
| 45 | xlsx-q1-c3 | XLSX | same | 3 | 2 | Exact | "Support", "7" | yes | yes | OK |
| 46 | xlsx-q1-c4 | XLSX | same | 4 | 2 | Exact | same | yes | yes | OK |
| 47 | xlsx-q2-c1 | XLSX | Software Q1 | 1 | 1 | Related | Travel row; Software row unmarked | no | yes | P2-1 |
| 48 | dev-xlsx-c0 | XLSX dev | = 44 | | | | | | | repeat |
| 49 | txt1-q1-c1 | TXT | repairs, oak | 1 | 1 | none | old span: title + "Week o" | no | top | P2-5 |
| 50 | txt1-q2-c1 | TXT | inspector | 1 | 1 | none | old span: "…gallon of o" | partly | yes | P2-5 |
| 51 | txt1-q2-c2 | TXT | same | 2 | 1 | none | old span: "He praised … week of" | yes | yes | P2-5 |
| 52 | artxt-q1-c1 | TXT ar | children | 1 | 1 | none | old span: title + first sentence | no | top | P2-5 |
| 53 | artxt-q2-c1 | TXT ar | digital lab | 1 | 1 | none | old span: wrong sentence | no | yes | P2-5 |
| 54–55 | dev-txt-c0, dev-artxt-c0 | TXT | = 49, 53 | | | | | | | repeat |
| 56 | pdf-q1-c1 | PDF | BLEU | 1 | 8 | Related | region box | yes | yes | OK |
| 57–58 | pdf-q1-c3/c4 | PDF | pills that share no. 1 | 1 | 8 | Related | unchanged | | | P3 |
| 59 | pdf-q2-c1 | PDF | heads | 1 | 5 | Exact | line box "…h = 8…heads." | yes | yes | OK |
| 60 | pdf-q2-c2 | PDF | same | 2 | 4 | Related | region box | yes | yes | OK |
| 61 | dev-pdf-c5 | PDF dev | = 59 | | | | | | | repeat |
| 62 | dev-pdf-c9 | PDF dev | same question | 3 | 5 | Exact | 2 line boxes "Multi-head attention allows…" | yes | yes | OK |
| 63 | url-stray-c1 | URL | question not in doc (answer says so) | 1 | 1–2 | Related | 21 region, contents list | n/a | yes | OK |
| 64 | url-q1-c1 | URL | = 63 | | | | | | | repeat |
| 65 | url-q1-p3 | URL | multi-line docstring | 1 | 2 | Exact | 4 exact incl. "Multi-line docstrings consist…" | yes | yes | OK (P3 wide) |
| 66 | url-q1-p7 | URL | same | 2 | 2 | Exact | "…indented the same as the quotes…" | yes | yes | OK |
| 67 | url-q1-p8 | URL | same | 3 | 3 | Exact | "…place the closing quotes…" | yes | yes | OK |
| 68 | dev-url-p8 | URL dev | = 67 | | | | | | | repeat |
| 69 | dev-url-p15 | URL dev | same question | 7 | 3–4 | Exact | "Docstring processing tools will strip…" | yes | yes | OK |
| 70 | dev-url-p12 | URL dev | same question | 6 | 2–3 | Exact | "Insert a blank line after all docstrings…" | yes | yes | OK |

## What I could not test

- DOCX/PPTX slide view: LibreOffice is not available locally.
- The Wikipedia URL: the import fails with `NO_TEXT_CONTENT`, and `da2617e` is not in this branch. I used PEP 257 instead.
- Real mobile browsers. I used only Chrome emulation with synthetic touch.
- Not covered:
  - Reduced motion.
  - Dark mode.
  - Interface languages other than English.
  - A language switch during an active citation.
  - The collection reader page itself.
  - Anonymous demo documents.
- A stable build, so I could not compare P2-3 against it.
- A Quote Finder jump to a single-page chunk.

## Method

**Stack.** All on localhost, from the worktree:

| Part | Setup |
|---|---|
| Backend | :8001 |
| Celery worker | solo pool, Redis db 9 |
| Frontend | `next start` on :3000; `next dev` for the console check |
| Postgres | scratch DB `doctalk_golden` |
| Object storage | MinIO bucket `doctalk-golden` |
| Vector store | Qdrant collection `doctalk_golden` |
| Browser | my own headless Chrome, driven over the DevTools Protocol |

- **Not touched:** the stale :8000 backend, the `doctalk` DB, the Supabase stack and the desktop browser pane.
- **LLM calls:** chat and Quote Finder made real calls with the local `.env` keys.
- **Fixtures:** all synthetic or public:
  - `make_highlight_fixtures.py`: MD, DOCX, PPTX, XLSX.
  - My own synthetic files: `coastal-handbook.md`, `depot-manual.docx`, `lighthouse-log.txt`, `oasis-library-ar.txt`.
  - The seed PDF.
  - The PEP 257 URL.
- **Test user:** local-only, set to plan pro by SQL to pass the 3-document cap. Its credentials are in a scratch file outside the repo.
- **Left in place:** `doctalk_golden`, the bucket, the collection and Redis db 9. Three demo PDFs in `doctalk_golden` stay in `parsing` because of an early worker-pool failure. They have no effect on the results.
