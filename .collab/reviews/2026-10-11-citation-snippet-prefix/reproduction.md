# Citation `text_snippet` without the section-title prefix — F21 reproduction, before/after

Owner decision 2026-10-11: `text_snippet` must no longer carry `"{section_title}: "`.
Branch `claude/cool-sagan-rx2q4q` off `main` @ `d46fc22` (`fix/parse-heading-detection` is not on the
remote and was not available, so this sits on `main`; the two touch different files).

**Conclusion.** The prefix was the reason the TextViewer matcher never found DOCX/MD citations whose chunk has a
`section_title`. After the change those match 6/6 (from 1/6), and stored legacy snippets match too. **F21 is not
resolved by this change alone:** for MD/DOCX/PPTX/XLSX/URL a match only produces a small "Page N" caption and a
scroll to it. `MarkdownContent` has no inline highlight by design (the I25 comment in `TextViewer.tsx`). The
inline-highlight work in `.collab/plans/2026-10-11-citation-highlight-all-formats.md` is still required.

## Setup (local, cloud container)

- `docker compose up -d` (images via `mirror.gcr.io`: Docker Hub answered 429; the minio digest matches the pin),
  `alembic upgrade head`, uvicorn, Celery worker (`-Q default,parse`), `npm run dev`. LibreOffice present, so
  DOCX gets `converted.pdf`.
- No LLM keys in the container: `OPENROUTER_BASE_URL`/`DEEPSEEK_BASE_URL` pointed at a local stub (hashed
  bag-of-words embeddings; the chat answer quotes the best-overlapping retrieved sentence and cites its `[n]`).
  Retrieval quality is not under test; the citation payload, persistence and reader are the production code.
- Signed-in user created through the adapter API; Auth.js session cookie minted with `next-auth/jwt` `encode`.
- Golden path driven by Playwright: upload in the dashboard → ask → click the citation card → read the DOM.

Fixtures (generated, not committed): `northwind.docx` (Title + three `Heading 1` sections, ~180 words each),
`northwind.md` (starts with `# Title`, then `##` sections), `northwind-lead.md` (same, with one lead paragraph
before the first heading, as READMEs have).

## What the stored chunks look like

| Fixture | `chunks.section_title` | chunk text |
|---|---|---|
| DOCX | set on every chunk after a heading | body only |
| MD, lead paragraph | set | body only |
| MD, `#` first | **NULL on every chunk** | heading glued in: `"Northwind Valley Field Guide This guide describes…"` |

Why the third shape: `parse_worker.py:486-505` gives each extracted page an 18 pt title block and a 12 pt body
block. When every page has a title, the median font size is 15, and 18 < 15 × 1.25, so `_is_heading_block`
(`parse_service.py:825`) rejects the title and it becomes body text. One untitled page drops the median to 12.
The prefix never existed for this shape; this change cannot help it (separate parse issue).

## Browser run (golden path)

| | Before | After |
|---|---|---|
| DOCX, Text view, new citation | card `Power Grid: Power lines run on woode…`; **no caption, no highlight**, page scrolled | card `Power lines run on wooden poles along…`; **caption "Page 3" in view**, no inline highlight |
| DOCX, Text view, citation stored before the change | — | still prefixed in the DB; **caption "Page 3" in view** (legacy fallback) |
| DOCX, Slides view (converted PDF) | "Citation 1 · Page 3–4 · Source page unavailable" | unchanged |
| MD with lead paragraph, new / stored citation | prefixed; no caption | caption "Page 4" in view / caption "Page 4" in view |
| MD `#` first | no prefix (title NULL); caption shown for this chunk | unchanged |

Screenshots: `repro/{before,after}/*.png` in the session scratchpad (not committed).

## Every chunk, not just the one the stub cited

Replay of TextViewer's matcher for each chunk's snippet against `/text-content` for its `page_start`
(old = prefixed snippet + matcher at HEAD; new = chunk text + new matcher; legacy = prefixed snippet + new matcher):

| Fixture | Before | After | Legacy snippet, new matcher |
|---|---|---|---|
| DOCX | 1/6 | **6/6** | 6/6 |
| MD, lead paragraph | 1/6 | **6/6** | 6/6 |
| MD, `#` first | 5/6 | 5/6 | 5/6 |

The remaining miss is the `#`-first MD's chunk 0 (glued-in heading).

## Point 3: converted-PDF path (`PageWithHighlights`)

Unaffected by the prefix, so no change was made there:

1. `converted.pdf` for the DOCX has **2** pages; citations carry extracted-section numbers (3, 4), so the slide
   view reports the page as unavailable.
2. Stored bboxes are slivers, `{x:0, y:0.000126, w:0.0016, h:0.0011}` (synthetic `(0, 0.1, 1, 1)` in points
   normalised by 612×792). The dummy test `x===0&&y===0&&w===1&&h===1` (`PageWithHighlights.tsx:66`) never
   fires, so `candidate = highlightFocus` and `highlightSnippet` is never consulted on this path.
3. Even if it fired, `findEvidenceRange` needs the whole needle, word-bounded; a 100-char truncation usually ends
   mid-word.

## Verify set (final, after the review fixes)

- `npm run build` — passes.
- `npm run test:unit` — 236 pass (7 new in `tests/snippet-match.test.cjs`, 1 new in `citation-state.test.cjs`).
- `ruff check app/ tests/` — clean.
- `pytest tests/test_parse_service.py` — 29 pass; all non-integration — 1151 pass (6 new in
  `test_citation_snippet_shape.py`).
- `SKIP_INTEGRATION=0 pytest -m integration` (one process, local Postgres 16.6 + MinIO + Qdrant 1.14.1) — 138 pass.
- The every-chunk replay gives the same numbers with the review's 30-char fallback floor.
