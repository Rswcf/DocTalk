# Fable plan: citation snippet prefix branch (2026-10-15)

Author: Fable 5.1 (Plan agent), at the owner's request "按 Fable 的推荐继续推进引文前缀那个分支".
Input: `origin/claude/cool-sagan-rx2q4q` @ 3e7b39b5 against main f987d67a. Executed by Claude; owner decisions a–c taken as recommended, d (release) asked separately.

## Recommendation: GO — as a rebase onto today's main, not a plain merge

Verdict and reasons:

- The backend half applies cleanly. All four backend files (`documents.py`, `chat_service.py`, `claim_verifier_service.py`, `extraction_service.py`) and `test_extraction_service.py` are byte-identical between the branch base d46fc222 and origin/main f987d67a; `store/index.ts` and `citation-state.test.cjs` too. Only `TextViewer.tsx` and `frontend.md` conflict, and both conflicts are "main rewrote the surrounding text", not a semantic clash.
- The owner decision (snippet = chunk text, no `"{section_title}: "`) is still right on main: the shared page (`app/shared/[token]/page.tsx:120`), `ShareAnswerDialog.tsx:118`, `lib/export.ts:47` and backend `export_service._format_footnote` all print `text_snippet` inside quotation marks. That misquote exists in production today.
- Strategy ④ did not make the branch redundant: ④ never reads `text_snippet` (it uses `context_text` / `/api/chunks/{id}`), so the branch's effect on the highlight matchers is small and bounded (section 3). The branch's value today is correctness of the quoted text, plus ② (missing-file PDFs) and the Brief slide-view path.
- Reshape, not merge, because the branch's `frontend.md` bullet and commit message describe a three-strategy world ("made every DOCX/MD citation with a heading miss", "a match still renders only the Page N caption (I25)") that is false on main. Codex has never seen this change, and it changed matcher input, so it goes through the Codex gate before release.
- One real finding beyond the commit (section 3, tables): `_citation_payload` would attach `section_title = "Table p.N #k"` (an internal retrieval label, `retrieval_service.py:192`) to table citations. Same class as the summary label the branch already excludes. One-line fix plus a test.

Production is stable 2fa1e5b1 = main minus one `.collab` record, backend 0.36.1, no pending code on main. Clean window.

## 2. TextViewer conflict and the legacy fallback

Where `findSnippetInPage` lives: `frontend/src/lib/snippetMatch.ts` (the branch's location). Its only caller on main is `TextViewer.tsx:451` inside `if (usesEvidence || !highlightSnippet || !targetPage) return null;` — missing-file PDFs only (strategy ②). A pure function with its own unit test file belongs in `lib/`, consistent with `pdfEvidence.ts`, `textEvidence.ts`, `convertedEvidence.ts`.

Resolution, prescriptive:
1. `git checkout -b fix/citation-snippet-prefix origin/main` in a fresh worktree; `git cherry-pick -x 3e7b39b5`.
2. `TextViewer.tsx`: take main's version (`git checkout --ours -- frontend/src/components/TextViewer/TextViewer.tsx`), then make exactly two edits: add `import { findSnippetInPage } from '../../lib/snippetMatch';` next to the `PROXY_BASE` import, and delete the local function (doc comment through closing brace, main lines ~142-176). The call at ~451 must stay byte-identical: `tests/text-viewer-txt.test.cjs:163` pins `/findSnippetInPage\(page\.text, highlightSnippet\)/`, and `text-viewer-highlight.test.cjs:393` pins the `usesEvidence` guard. Verify with `git diff origin/main -- frontend/src/components/TextViewer/TextViewer.tsx`: only the import hunk and the deletion hunk.
3. `.claude/rules/frontend.md`: take main's version; do NOT carry the branch's bullet. Write a fresh one under "PDF & Documents" (after the four-strategy bullet): `text_snippet` is the chunk's own text (owner 2026-10-11); shared answers and exports quote it; ② (missing-file PDFs only) searches the page for it via `lib/snippetMatch.ts`; ④ touches `textSnippet` only as the last-resort fallback when the chunk fetch fails and the citation has no `context_text` (`TextViewer.tsx:416`); ③ receives `citationPassage(...)`, which falls back to `textSnippet` only for citations without `context_text` (Brief refs); the chat payload carries `section_title` separately for text chunks only (not summary, not table) and `claim_verifier_service._citation_context` reads it; stored citations keep the prefix, so the ② matcher retries after each `": "` in the first 200 chars, fallback ≥30 chars; summary citations never set `highlightSnippet`.

Legacy `": "` fallback: keep, scoped to ② as it already is. Reasons: ~100 missing-file PDFs (backend.md, v0.34.0) carry stored prefixed chat/extraction citations and `/text-content` serves their chunk text, so the body part can match; the ≥30-char floor and 7 unit tests exist; ② is by design an approximate prefix-progressive `indexOf` matcher, and the fallback is the same class of approximation. ④ and ③ never see it. Dropping it is the fallback position if Codex constructs a false positive the floor does not catch.

## 3. Effect of the de-prefixed snippet, per strategy and consumer

- ① native PDF (`PageWithHighlights.tsx:73`): reads `highlightSnippet` only when a `(0,0,1,1)` dummy box is present. I grepped backend/app on main and its history (`git log -S'"w": 1.0'`, `'"w": 1,'`) and found no emitter; `citation_location` filters boxes and never synthesizes one. That branch is unreachable with any backend-produced citation. ① is unchanged in practice; the golden-path PDF checks are regression only.
- ③ converted DOCX/PPTX (`DocumentReaderPageClient.tsx:447`): the viewer receives `activeCitationPassage = citationPassage(citation)`, not the store snippet. Raw `textSnippet` reaches ③ only when the citation has no `contextText`. Enumerating sources: chat citations have `context_text` (unchanged); extraction/diff/template have `context_text = chunk.text[:300]` with no page prefix (unchanged); Quote Finder cards and `?highlight=` links already carry un-prefixed text (`Quotes/utils.ts`, `DocumentReaderPageClient.tsx:171`); **Brief refs (`_brief_ref_payload`, no `context_text`) are the one path whose ③ input changes**, from a prefixed 180-char string that could never match to 180 chars of chunk text. Both gates still apply: `uniqueInPageRange` (once in the whole converted document AND inside the cited range) and `findEvidenceRange` (whole needle, word-bounded; a mid-word 180-char cut is rejected). No route to a wrong mark; possibly a new correct mark or, as today, "Page location only".
- ④ text view: input is `context_text` or the chunk fetch; `textSnippet` only when the fetch fails and there is no `context_text` (Brief again), then gated by uniqueness/page/coverage. Unchanged otherwise.
- Store `summary → highlightSnippet: null`: on native PDFs a summary citation has `bboxes: []` so ① never read it; ③ gets `citationPassage` (context_text); ④ ignores it. Outcome identical, input cleaner. `retrievalModality` is mapped on both SSE (`sse.ts`) and restore (`api.ts:84`) paths.
- Shared page / ShareAnswerDialog / `export.ts` / `export_service._format_footnote`: new citations quote chunk text (the fix). Old messages keep their stored prefixed snippet; a share of an old message is consistent with its stored message, and `PublicAnswerCitation` whitelists fields so the new `section_title` never enters a snapshot or digest.
- CitationCard: shows the first 60 chars of chunk text instead of "Title: text". The heading label disappears from the pill. Frontend mappers ignore `section_title`; nothing renders it today (owner decision 7b).
- Brief / Extraction / Diff / Templates panels: map `text_snippet` to `textSnippet` for display and for jumps; display changes to chunk text; jumps go through ③/④ as above. `DocumentBriefPanel.tsx:57` keys by `chunk_id || page-snippet` — fine.
- Quote Finder: builds citations from `display_text` / `quote_text`; chat `quote_search` artifacts use `card.display_text[:100]`. Not affected.
- Claim verifier: parity holds for text chunks via the new field; table chunks already have `table_context` in `_citation_context`; summary label words stop counting (correct). Headings over 98 chars now count in full (warn→pass in rare cases); the report feeds `_try_repair_rag_answer` (billed repair), so direction is fewer repairs, not more.
- Dedup with mixed old and new citations (`citationSourceKey` includes `textSnippet`; `export_service.py:98` likewise): a session continued across the deploy lists the same chunk twice in References once. Accepted as a one-time effect (subagent NIT 4); Codex to confirm.

Code changes needed beyond the commit:
1. `backend/app/services/chat_service.py` `_citation_payload`: attach `section_title` only for text chunks — `if chunk.section_title and not is_summary and not chunk.table_id`. Add a test in `test_citation_snippet_shape.py` (table chunk: no `section_title`; verifier still passes via `table_context`). Reason: `retrieval_service.py:192` sets `section_title = "Table p.N #k"` and `_chunk_info_from_persisted_citation` (chat_service.py:1203) sets it to the first `table_context` line — an internal label, not a heading.
2. `backend/scripts/make_highlight_fixtures.py:222`: drop the prefix from the reimplemented formula; rerun `tests/test_extractors_office.py` (its `startswith("Study design The trial enrolled")` is a glued-title chunk, so it stays green).
3. `frontend/src/lib/citationText.ts:122-123`: comment still says `text_snippet` is `"{section_title}: " + chunk.text`.
4. `docs/ARCHITECTURE.md:984` "old snippet prefix match": reword to "snippet match" so it is not read as the section-title prefix.
5. `.collab/reviews/2026-10-11-citation-snippet-prefix/review-r1-claude-subagent.md` quotes `-m gpt-5.5`; fix in the new record rather than editing history.

Places where old (prefixed) and new citations must both work: ② via the legacy fallback (only place that matters); ③/④ via `context_text` (prefix never mattered); shared page / exports (both print whatever is stored, by design); `citationSourceKey` dedup (degrades gracefully).

Out of scope, note only: `citationChunkText` treats `_citation_from_chunk`'s 300-char `context_text` as untruncated (limit 900), so ④ for extraction/diff/template citations locates against a cut chunk. Never a wrong mark (sentences must match page text), but a weaker label than possible. Separate follow-up.

## 4. Verification before ship

Unit/static (expected counts: 0.36.1 baselines were unit 360, backend non-integration 1190, integration 138, build 426 pages):
- `cd backend && python3 -m ruff check app/ tests/`
- `python3 -m pytest tests/test_citation_snippet_shape.py tests/test_extraction_service.py tests/test_extractors_office.py tests/test_claim_verifier_service.py tests/test_export_service.py tests/test_export_citations.py tests/test_sharing_api.py -v` then `python3 -m pytest -m "not integration"` (expect ≥1197 with the table test)
- `SKIP_INTEGRATION=0 python3 -m pytest -m integration` locally if docker is up; otherwise CI's integration job (the `test_answer_sharing_integration.py` fixture is literal text, unaffected)
- `cd frontend && npm run test:unit` (expect 368: +7 `snippet-match`, +1 `citation-state`), `npx tsc --noEmit`, `npm run lint`, `npm run build`
- `python3 scripts/check_version_consistency.py` after the bump
- `git diff origin/main -- frontend/src/components/TextViewer/TextViewer.tsx` shows exactly the import and the deletion

Browser acceptance (local stack, `next build && next start`, about 12 jumps, 0 wrong marks required; record as `acceptance-2026-10-15.md` in the review folder):
- Native PDF (seed paper), 2 citations: labels and boxes identical to 0.36.1 (① regression).
- MD + DOCX text view (fixtures from `backend/scripts/make_highlight_fixtures.py`), 3 citations: Exact/Related as before (④ regression); CitationCard shows chunk text with no heading prefix; the SSE payload has `text_snippet` without prefix and `section_title` present (DevTools).
- Missing-file PDF (②): upload a PDF with headings, ask once BEFORE switching to the new backend (stores a prefixed citation), then delete the object in local MinIO (console or `mc rm`), reload: reader shows TextViewer + MissingFileNotice. Click the old citation → highlighted span on the passage (legacy fallback). Ask again on the new backend, click → span on the passage. 2 jumps.
- Regenerate/continue in that pre-deploy session: old and new citations coexist; the answer renders; export lists the duplicate reference once per chunk at most twice.
- Shared answer page and ShareAnswerDialog preview: quoted text is chunk text. Markdown export: footnote quotes chunk text. 2 checks.
- Brief panel ref jump in PPTX slide view (③, the one changed input): status honest, no wrong mark. Needs LibreOffice locally (round 2b's Mac had none); if absent, this becomes a production check as 0.36.1's PPTX item did.
- One summary-style question on a long PDF ("summarize the whole document") → click the summary citation → page only, no stray mark.

## 5. Codex review — attack list

Mechanics: new prompt file `.collab/reviews/2026-10-11-citation-snippet-prefix/codex-r1-prompt-2026-10-15.md` with `git diff origin/main...HEAD` pasted inline (Codex cannot run git; the old prompt says `git diff main...HEAD` — replace it). Run `cat prompt | codex exec -m gpt-6-astra --sandbox workspace-write -C <worktree>`. Save output as `codex-r1-output.md`; iterate to consensus.

Points to attack (each with file:line evidence, BLOCKER / SHOULD-FIX / NIT / OK):
- The rebased `TextViewer.tsx` vs main: is `findSnippetInPage` reachable from any evidence format (TXT, MD, URL, XLSX, DOCX/PPTX text view) after the move? Is the `usesEvidence` guard intact?
- Strategy ③ Brief path: `_brief_ref_payload` (180 chars, no `context_text`) → `citationPassage` → `uniqueInPageRange` + `findEvidenceRange`. Construct a converted DOCX/PPTX where 180 chars of chunk text occur once in the document but on a LibreOffice page outside the cited extractor range, or where whitespace squeezing lets the uniqueness gate pass on a mid-word cut. Can either produce a drawn box, or only "Page location only"?
- Strategy ①: confirm no backend path emits a `(0,0,1,1)` box (`citation_location.py`, `parse_service._normalize_bbox`, extraction, Brief), so the native-PDF snippet branch stays unreachable.
- Legacy fallback in ②: a ≥30-char tail after `": "` that lands on a repeated line in a missing-file PDF's chunk-fallback page text (`get_document_text_content` chunk mode); is 200 the right bound given extractors cap titles at 200; should the fallback be dropped now that only ② uses it?
- `section_title` field: table citations (`retrieval_service.py:192`, `chat_service.py:1203`) after the fix; any other `_ChunkInfo` source whose `section_title` is a label rather than a heading; prompt-injection posture if the frontend later renders it (`_source_locator` collapses whitespace for the prompt, the payload does not).
- Claim verifier parity: table, summary, continuation (`_chunk_info_from_persisted_citation`) and the 900-char `context_text` cut; quantify where a verdict can flip and whether `_try_repair_rag_answer` (billed) can be triggered more often.
- Persisted JSONB and schemas: `citations` is `List[dict]`/JSONB (`tables.py:322`); `PublicAnswerCitation` whitelist; `DocumentBriefSourceRef`; export field list (`export_service.py:98`); frontend `mapCitationPayload`/`sse.ts` ignore the key — anything that rejects or leaks it?
- Mixed old/new citations in one continued session: `citationSourceKey`, `uniqueCitationIndexes`, `export_service` dedup, `insertCitationMarkers` — any duplicated or lost marker, not just a duplicated reference?
- Compatibility during the backend-first window (old frontend + new backend) and the reverse (Vercel preview + production backend).
- Docs and copy: any remaining sentence in `.claude/rules/*.md`, `docs/ARCHITECTURE.md`, `frontend/src/**` comments or the 11 locale files that still describes the prefix.
- Summary citations' `text_snippet` is still internal coverage text on the shared page and exports (pre-existing; is this release the place to blank it?).

## 6. Release plan

Version: **0.36.2** (fix-class, add-only payload field, no migration). Bump with `python3 scripts/bump_version.py`, write `CHANGELOG.md` and `CHANGELOG.zh.md` entries under "Fixed" (misquoted source on shared answers and exports; citations on PDFs whose file is missing now highlight) and "Changed" (chat citation payload carries `section_title` for text chunks), then `python3 scripts/check_version_consistency.py`.

Ordering (deploy skill): branch → Codex consensus → browser acceptance → bump → merge to main → CI green (backend, frontend, integration, docker) → ask owner → `git checkout stable && git merge --ff-only origin/main` from the main checkout → `railway up --detach --service backend` → `/health` reports 0.36.2 → `git push origin stable` → Vercel Ready → `git checkout main` → production checks → `release.md` in the review folder.

Deploy authorization: **the owner's message does not cover `railway up`.** It approves proceeding with the branch as recommended; it is not a release approval, and this plan still contains an open Codex gate whose verdict the owner has not seen. The repo's own precedent is a distinct yes per release ("CI 绿后发布" for 0.36.1, "签字，发布" for highlight-all-formats). Claude must present CI, Codex verdict, acceptance counts and the version in one message and ask once before `railway up`.

Production checks after deploy:
1. `/health` → 0.36.2.
2. Owner account, DOCX with headings (test doc `41bb6407` if still present): ask one question; network tab shows `text_snippet` without prefix and `section_title`; CitationCard shows chunk text; text-view jump labels unchanged.
3. Share that answer → shared page quotes chunk text; Markdown export footnote likewise.
4. Seed PDF demo: one citation jump, bbox highlight and label unchanged.
5. PPTX `0089131c` Brief panel → one source-ref jump in slide view: honest status, no wrong mark (the ③ input that changed).
6. An old session on the DOCX: click a pre-deploy citation → ④ unchanged.
7. Railway logs for 24 h: `citation_repair` rate not above the prior day; no new 5xx on `/api/chat`.

Rollback: no migration, so the previous backend image (0.36.1) redeploys safely per the deploy skill. Frontend: Vercel "promote previous deployment" or revert stable to 2fa1e5b1. Mixed versions are safe in both directions (old frontend ignores `section_title` and matches the plain snippet; new frontend has the legacy fallback), so either half can roll back alone; backend-first remains the rule for the forward deploy.

## 7. Owner decisions

a. Table citations: skip `section_title` for table hits (recommended, one line + test) — or ship as the branch has it and document that the field may hold `"Table p.N #k"`.
b. CitationCard loses the heading prefix in its 60-char preview. Surface `section_title` as its own muted label on the card later (needs i18n in 11 locales; `viewer.section` exists), or leave the card text-only. Recommend: leave for this release, decide separately.
c. Legacy `": "` fallback: keep (recommended) or drop, pending Codex.
d. Release approval for 0.36.2 after CI and Codex — a separate yes.
e. Side note: CLAUDE.md and AGENTS.md "Codex collaboration" still prescribe `-m gpt-5.5`, rejected since 2026-10-14; a one-line doc fix can ride in this release or go separately.

## Execution order for Claude

1. New worktree, `fix/citation-snippet-prefix` from origin/main; `git cherry-pick -x 3e7b39b5`; resolve as in section 2; commit.
2. Commit "rebase notes": fixture formula, `citationText.ts` comment, `frontend.md` bullet, `ARCHITECTURE.md:984`.
3. Commit table `section_title` exclusion + test.
4. Run the unit/static set; fix; write the Codex prompt with the diff inline; run `-m gpt-6-astra`; address findings; repeat to consensus; save records.
5. Browser acceptance (section 4); record.
6. Bump 0.36.2 + changelogs; push the branch; merge to main; CI.
7. Ask the owner; deploy backend-first; production checks; `release.md`.

### Critical Files for Implementation
- /Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/TextViewer/TextViewer.tsx (conflict; import + delete local matcher only)
- /Users/mayijie/Projects/Code/010_DocTalk/backend/app/services/chat_service.py (`_citation_payload`: snippet, `section_title` for text chunks only)
- /Users/mayijie/Projects/Code/010_DocTalk/frontend/src/lib/snippetMatch.ts (new, from the branch; the ② matcher with the legacy fallback)
- /Users/mayijie/Projects/Code/010_DocTalk/.claude/rules/frontend.md (conflict; fresh bullet against the four-strategy text)
- /Users/mayijie/Projects/Code/010_DocTalk/backend/tests/test_citation_snippet_shape.py (new, from the branch; add the table case)

Also touched: `backend/app/api/documents.py`, `backend/app/services/extraction_service.py`, `backend/app/services/claim_verifier_service.py`, `backend/scripts/make_highlight_fixtures.py`, `frontend/src/store/index.ts`, `frontend/src/lib/citationText.ts`, `docs/ARCHITECTURE.md`, `version.json`, `frontend/package.json`, `frontend/package-lock.json`, `CHANGELOG.md`, `CHANGELOG.zh.md`.