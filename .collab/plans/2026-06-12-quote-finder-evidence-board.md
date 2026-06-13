# Quote Finder + Evidence Board — Design Plan (Round 1)

**Date:** 2026-06-12
**Author:** Claude (research-backed; 3 parallel research streams: verbatim-quote tech, citation-formatting tech, codebase audit)
**Status:** ROUND 3 — CONSENSUS CANDIDATE. Codex r1 (`.collab/reviews/2026-06-12-quote-finder-codex-r1.md`) + r2 (`...-codex-r2.md`) findings ACCEPTED in full; resolutions in §8 below override conflicting text in D1–D8/§5. Dialogue: `.collab/dialogue/2026-06-12-quote-finder-r1.md`.
**Goal:** First real paying users. Strategy ratified from production Q&A analysis (2026-06-12): the best-retained organic users are thesis writers extracting verbatim quotes + page numbers from their PDFs (users bas\*\*\*, mel\*\*\*, ric\*\*\*, mca\*\*\* — the ONLY multi-week-retention cohort in the entire DB). Build the workflow they are hand-rolling through chat today.

**Explicitly OUT of scope (owner decision 2026-06-12):** lifecycle/re-engagement emails of any kind.

---

## 1. Product shape

1. **Quote Finder** — a deliberate action on a document (and later collection): user enters a topic ("translator invisibility caused by fluency"), gets back a list of **machine-verified verbatim quote cards**: exact source text, page number, jump-to-highlight, one-click copy as APA/MLA/Chicago in-text citation with page locator.
2. **Evidence Board** — saved quotes persist per document/user with note field; export quote bank as DOCX / BibTeX / RIS (Plus-gated).
3. **Monetization**: quote search costs credits like a chat message (two-stage debit, existing); saving quotes is the habit hook — Free caps at `FREE_SAVED_QUOTES_LIMIT=20`; exports (DOCX/BibTeX/RIS) ride the existing Plus export gate.
4. **Trust contract (the differentiator)**: a quote card is NEVER shown unless the server verified the text verbatim against the stored page text. Competitive research confirms no incumbent (Scite/Elicit/SciSpace/Anthropic Citations) guarantees verbatim quotes + page + sub-page highlight from the user's own PDF.

## 2. Architecture decisions (research-grounded — do not re-litigate without new evidence)

### D1. Verbatim guarantee: "LLM proposes, verifier disposes, source displays" (REVISED r2)
Pattern from Deterministic Quoting (healthcare RAG) + Google LangExtract + Anthropic Citations API design.

> **r1 correction (Codex catch, prod-verified 2026-06-12):** `pages.content` is **NULL for ALL PDF pages** (9,243/9,243 in prod; `parse_worker.py:214-239` populates `extracted_content_map` only in the `file_type != "pdf"` branch). The original "verify against raw page text" design had no verification target for the dominant format. Revised as follows.

- DeepSeek only *proposes* quotes (JSON: `{quote_text, source_ref_n, page}`), with abstention licensed in the prompt ("if no relevant quotes exist, return []" — Anthropic's documented quotes-first pattern).
- Server-side **verification gate** locates each proposed quote in **`chunks.text` of the cited chunk (± retrieved neighbors)** — the exact text the LLM saw, already in Postgres for every document and format:
  - **Tier 1**: exact substring in the cited chunk's text → `exact`.
  - **Tier 2**: exact substring in normalized space, projected back to chunk-text offsets via an index-preserving offset map → `normalized`.
  - **Tier 3**: `rapidfuzz.fuzz.partial_ratio_alignment(quote_norm, chunk_norm, score_cutoff=90)`; auto-accept ≥95 with length-ratio sanity check → `aligned`. 90–95 → flagged, not auto-shown.
  - Below cutoff or ref cross-check mismatch → **dropped** (counted, shown as "n verified, m discarded").
  - **Displayed text is ALWAYS the chunk-text slice — never the LLM emission.** The guarantee becomes "verbatim w.r.t. our stored extraction", whose cleaning (header/footer strip, dehyphenation, whitespace collapse) matches what PDF copy-paste produces; the one-click bbox jump lets the user eyeball the original instantly.
  - **Dedup**: 50-token chunk overlap means one quote can verify in two chunks → dedupe by (normalized quote text, page).
- **Fidelity upgrade path (same release, forward-only):** parse_worker starts persisting raw per-page text for PDFs into `pages.content` (capture `page.get_text()` in the existing extract pass; trivial). New uploads then get page-level Tier-1 verification + page-grounded display; old docs stay on chunk-level verification. No mass re-parse, no lazy MinIO fetch in v1.
- Page disambiguation for repeated phrases: trust the cited chunk's `page_start/page_end`; cross-chunk duplicates resolved by dedup rule above.
- Docs where `text_quality` is present AND < 0.75 (doc-level nullable column, migration 0032): cap at flagged tier, never auto-accept Tier 3. NULL `text_quality` (pre-R2b docs) = no cap (text-layer docs), but `parse_method='ocr'` without quality always caps.
- **New dependency: `rapidfuzz`** (C++, the same migration Google made for LangExtract; provides score-AND-locate in one call). `edlib` deferred — YAGNI for v1.

### D2. Normalization pipeline (shared, index-preserving)
NFKC → strip soft hyphen U+00AD + tatweel U+0640 → fold curly quotes/dashes/ellipsis + CJK fullwidth/corner quotes 「」『』 → rejoin line-break hyphenation → collapse whitespace (incl. NBSP, U+3000) → casefold (fuzzy tier only). Arabic extra: strip Mn (tashkeel), normalize alef/hamza set. CJK: character-level matching everywhere, no word tokenization. Both sides (LLM quote AND page text) run the identical pipeline; matching happens in normalized space; results project back through the offset map.

### D3. bbox/highlight: reuse, don't rebuild (CLARIFIED r2)
Verified r1: chunks store **line-level** normalized bboxes (JSONB list with page; `parse_service.py:834` "line-level bbox precision", accumulated at `:790`), and `chat_service.py:203-260` already assembles the citation payload `{chunk_id, page, page_end, bboxes, snippet, ...}` from them; frontend has 3 highlight strategies incl. text-snippet fallback. Quote cards emit the same citation payload shape: bboxes = the cited chunk's line bboxes for the quote's page; frontend `findSnippetInPage(verifiedSlice)` narrows to the quote. **No parse-pipeline change required for highlight; works on all existing docs.**

### D4. Retrieval: reuse hybrid + over-retrieve
Existing stack (semantic Qdrant + lexical ILIKE + RRF + dynamic top_k) is sufficient for v1; quote queries are recall-bound → boost top_k for quote searches (~2× chat). Postgres FTS/pg_trgm is a known gap — deferred unless replay shows recall failures.

### D5. Citation formatting: citeproc-py, not Node, not hand-rolled
- `citeproc-py` 0.9.3 (Apr 2026, active; used in production by Zenodo via `citeproc-py-styles`) + official CSL styles: APA 7, MLA 9, Chicago author-date. Supports page locators (`Locator('page','17')`) → "(Venuti, 1995, p. 17)".
- Known gap: no year-suffix disambiguation (1995a/1995b) → deterministic 20-line pre-pass (group by author+year, append suffix).
- Correctness contract: golden snapshot tests vs Zotero-generated output for ~10 representative items.
- Fallback: per-style template functions behind the same `format_citation(item, style) -> (in_text, bibliography)` interface.
- Rejected: citeproc-js/citation-js (Node sidecar = new infra, AGPL concerns), pandoc binary (~100MB, shell-out), full hand-roll (multi-author/title-case/et-al rules are deceptively expensive for an audience that will notice errors).

### D6. Bibliographic metadata: Zotero's hybrid pattern, no GROBID
1. PyMuPDF doc metadata + first 2–3 pages text (already in `pages.content`).
2. Regex scan ~first 80 lines for DOI / ISBN / arXiv ID → Crossref `works/{doi}` (polite pool, `mailto=`) / OpenLibrary (1 rps anon → identified UA).
3. No identifier → DeepSeek structured extraction (JSON plumbing exists in extraction feature).
4. Optional Crossref `query.bibliographic` verify (accept top hit only above title-similarity threshold).
5. **Always lands in a user-editable form** (Zotero's UX); cached per document (`document_biblio` table, CSL-JSON + source flag).
- Rejected: GROBID (8GB Docker/Java service, accuracy validated on scholarly articles not books; new Railway infra for a solo dev).

### D7. Exports
- DOCX quote bank: `python-docx` (already a dep), extend existing `export_service.py` + reuse `_sanitize_xml_text`.
- BibTeX: hand-rolled writer (~50 lines; bibtexparser v2 still beta and we only generate).
- RIS: hand-rolled writer (~half day) — imports into Zotero/Mendeley/EndNote; cheap differentiator. Zotero Web API push deferred to v2.

### D8. Data model (Alembic after 20260524_0032)
```
saved_quotes: id uuid pk, user_id fk, document_id fk, page int,
  quote_text text (raw slice), bboxes jsonb, verification_tier text,
  note text null, created_at, updated_at
document_biblio: document_id pk fk, csl_json jsonb, source text
  ('identifier'|'llm'|'user'), updated_at
```

## 3. Funnel fixes bundled (week 1, no emails)
- **Activation-collapse investigation**: 16/19 post-05-24 signups never uploaded (was 56%); 116 magic-link requests → ~19 signups in 19 days. Instrument signup→first-upload path, audit SEO locale-page entry UX, verify magic-link completion on prod. Diagnostic first; fixes follow evidence.
- **Restore document-generated suggested questions** (backend still populates `documents.suggested_questions`; commit 6693342 removed display). Restore ONLY the per-document generated ones, not the generic hardcoded list.
- **Move the paywall off the upload gate**: FREE max file size 25→50MB (config). The single historical payer paid at this gate *before experiencing value* and churned same day.
- Verify Stripe plan→credits mapping with a test-mode purchase (suspected +300-instead-of-3000 from 05-23 retro; current code reads correct).

## 4. Acquisition (week 4, code-only)
Programmatic SEO tool pages on the existing Phase-A locale-URL + editorial-kit pattern: `tools/pdf-quote-finder`, `tools/citation-from-pdf` (× 11 locales). Demo doc: add a theory-book PDF with a prefilled quote-finder example (current demo set skews finance; organic users are academic).

## 5. Sequencing
- **W1**: funnel fixes + `quote_verification_service` (normalization + 3-tier gate, TDD — this is the riskiest pure-logic component, fully unit-testable).
- **W2**: Quote Finder endpoint + retrieval boost + DeepSeek JSON prompt + quote-card UI w/ jump-to-highlight + copy-citation (in-text only, biblio service stub).
- **W3**: Evidence Board (tables, CRUD, board UI, caps) + biblio pipeline + citeproc-py wrapper + exports (DOCX/BibTeX/RIS, Plus gate).
- **W4**: SEO tool pages + demo doc + polish + in-prod replay vs the real user queries (bas\*\*\*/mel\*\*\*/ric\*\*\*/mca\*\*\* query corpus as acceptance tests).

## 6. Known risks / failure modes
- DeepSeek JSON adherence (mitigated: existing extraction JSON plumbing + retry-on-parse-fail).
- Hallucinated source refs (mitigated: ref range-validation + echoed-text cross-check — double signal).
- Quote recall too low on big docs → over-retrieve; if replay shows misses, add pg_trgm phrase search (explicitly deferred, not forgotten).
- OCR/garbled pages → text_quality cap (D1).
- citeproc-py style bugs → snapshot tests + per-style fallback templates (D5).
- Crossref/OpenLibrary offline → pipeline degrades to LLM extraction + user edit (D6 order is graceful).

## 7. Open questions — RESOLVED r2 (Claude positions amended by Codex r1+r2; final form in §8.4)
1. **Credit pricing of a quote search → chat-style token two-stage debit** (predebit 15 like balanced, reconcile to actual). It is one LLM call over retrieved context — same cost shape as chat; flat extraction-style predebit (`EXTRACTION_PREDEBIT_CREDITS` precedent, `extractions.py:213`) overcharges short docs and is reserved for multi-call jobs.
2. **`FREE_SAVED_QUOTES_LIMIT=20` on LIVE board count** (deleting frees a slot) — matches the "3 active share links" free-cap precedent (`sharing.py:85`). 20 ≈ one seminar paper's evidence, less than a thesis chapter — right pressure point.
3. **Chat routing: keep chat untouched in v1.** When the existing query router detects quote intent in a chat message, render a non-blocking "Try Quote Finder" chip above the answer (UI only, zero chat-pipeline risk). Auto-rerouting deferred to v1.1 — silent behavior changes in chat were the source of past regressions (R2a router gate history).
4. **`document_biblio` separate table** — documents is already wide; biblio has its own lifecycle + source flag; precedent: extraction results live in their own table joined to DocumentJob.
5. **Tier-3 thresholds stand (95 auto / 90–95 flagged).** With chunk-side display (r2 revision) a false-accept can no longer corrupt *wording* — only *attribution* — so the threshold guards location accuracy; stricter-than-LangExtract remains correct because our claim is a guarantee, not best-effort extraction.

---

## 8. Round-2 consensus resolutions (ACCEPTED from Codex r1+r2 — these override conflicting text above)

### 8.1 Verification substrate preconditions (amends D1/D2)
The chunk pipeline is a sound anti-hallucination gate but NOT yet a verbatim-display substrate. Before any quote card renders chunk text:
- **Fix sentence-split mutation**: `_split_into_sentences` (parse_service.py:893-906) + strip/rejoin (:482-487, :765-782) corrupts `U.S.`→`U. S.`, `3.14`→`3. 14`. Chunk display text must come from offset-preserving slices of cleaned block text, or splitting gets abbreviation/decimal guards. Fidelity tests required: `U.S.`, `e.g.`, decimals, DOI strings.
- **Fix hard-hyphen loss**: `_extract_line_blocks` (:855-864) turns `cost-\neffective` into `costeffective`. Mark line-break hyphen joins in an offset map (preserve/restore when ambiguous); tests for discretionary vs compound hyphens.
- **Persist PDF page text forward-only** (`page.get_text("text")` per page) AND store verification anchors on saved quotes: `source_chunk_id`, char offsets, `page_text_hash`, `quote_hash` — saved quotes must survive/revalidate after reparses.
- **Page derivation from the verified slice, not the LLM emission.** For `page_start≠page_end` chunks there is no offset→page map (tables.py:140-145): page-scoped verification where `pages.content` exists; chunk-fallback must reject or split ambiguous multi-page matches.
- **Dedup key**: `(document_id, normalized_quote_text, verified_page_range, start_offset-or-bbox-signature)` — not `(text, page)`.
- **Fuzzy guards**: tier-3 auto-accept additionally requires quote ≥ ~8 tokens / 40 chars, sane length ratio, match within the cited chunk/page window, and clean `text_quality`; short quotes / OCR / `text_quality<0.75` → exact/normalized only or flagged.
- **Honest trust labels**: chunk-fallback docs say "verified against extracted text"; only page-text-verified docs say "verified against page text". Quote Finder misses headings/headers/tables by construction (cleaning strips them) — say so in UI copy.

### 8.2 Highlight (amends D3 — Codex r1 verdict BLOCK accepted)
Persisted bboxes are bare `{page,x,y,w,h}` rects with no offsets/text (parse_service.py:526-530, :936-942) — span-level selection is impossible without reconstruction, and the PDF snippet-fallback only fires on all-dummy bboxes (PageWithHighlights.tsx:64-77).
- v1: emit the cited chunk's bboxes for the verified page, **label highlight precision as approximate**, store `source_chunk_id` + quote span offsets for future precision.
- Frontend change: allow a verified quote to snippet-highlight on the PDF text layer even when bboxes are present-but-coarse (extend, don't bend, the dummy-bbox path).
- Span-to-bbox word mapper (PyMuPDF reopen) = fast-follow, not v1.

### 8.3 Retrieval (amends D4)
Over-retrieve alone is insufficient (24-chunk cap, corrective_retrieval_service.py:92-114; lexical = ILIKE only). v1 adds deterministic candidate expansion: normalized phrase/term scan over the document's chunks (and page text where present) merged into candidates before generation. Telemetry per search: `retrieved_count`, `candidate_pages`, `proposed`, `verified`, `discarded(reason,tier,score)`, `no_result`. pg_trgm phrase index = first fast-follow if replay shows recall misses.

### 8.4 Open-question final resolutions
1. **Pricing**: dedicated quote-search debit, `reason="quote_search"`, predebit = balanced-mode estimate (15), reconcile to actual tokens, refund on system failure, charge actual cost on verified-empty results; recorded job-style (`UsageRecord.message_id=None`), surfaced in chat UX when routed from chat. (Synthesis of r1 job-accounting + r2 chat-style reconcile.)
2. **Caps**: count active saved quotes per user across documents. `FREE_SAVED_QUOTES_LIMIT=30` (r1: 20 risks cutting off thesis users pre-habit), `PLUS_…`/`PRO_…` unlimited-by-default constants in config.
3. **Chat routing: YES in v1** (both rounds concur; overrides Claude's defer position). Strict direct-quote intents only ("direct quote/verbatim/exact quotation/quote with page") — the `action_planner.py:218-225` CITATION_LOOKUP hook already exists; verified-pipeline failure returns "no verified quotes found", never unverified fallback text.
4. **Biblio**: separate table keyed **`(document_id, user_id)`** with a system row for auto-detected defaults — a user's edit must never mutate metadata for demo/shared docs (r2 catch: `Document.user_id` nullable, demo docs shared).
5. **Thresholds**: 95/90 stand + 8.1 guards.

### 8.5 Scope re-cut: the "First Paid Loop" milestones (replaces §5)
The first paid moment = verified quote **discovery → save → jump → copy (in-text citation + page)**. Everything else defers.
- **M0 (ship immediately, decoupled)**: funnel fixes §3 (Codex: SHIP) — incl. config change for FREE 25→50MB (config.py:156 still 25).
- **M1 — substrate**: parse fidelity fixes (8.1) + offset-preserving normalizer + `quote_verification_service` with real-PDF fixtures (multi-page, RTL/CJK, OCR, repeated phrases) — TDD, no UI until green.
- **M2 — loop**: quote-search endpoint (8.4.1 billing + 8.3 telemetry) + chat-intent routing + quote cards (8.2 approximate highlight; copy = quote + "(Author, Year, p. X)" APA in-text best-effort from a minimal user-editable metadata form seeded by filename/PyMuPDF metadata — NO Crossref/citeproc in v1) + academic demo doc + i18n for all new copy (11 locales).
- **M3 — retention + charge**: saved_quotes CRUD (D8 amended: + `source_chunk_id`, offsets, hashes, `verification_score`+verifier version, nullable bboxes, indexes, access control via `can_access_document` pattern, idempotent saves) + caps + trust labels + **in-prod replay vs the retained-academic query corpus (bas\*\*\*/mel\*\*\*/ric\*\*\*/mca\*\*\*) as acceptance gate** → enable Plus gating.
- **Fast-follow (post-validation only)**: citeproc-py full styles (MLA/Chicago) + golden Zotero tests, DOCX quote-bank export (then BibTeX/RIS), Crossref/OpenLibrary enrichment, pg_trgm, span-to-bbox precision mapper, collection-wide search, programmatic SEO tool pages.

### 8.6 Added risk register entries (amends §6)
Chunk-text mutation corrupting displayed quotes (8.1); hard-hyphen loss; page-attribution error on spanning chunks; same-page duplicate collapse; user-edited biblio leaking across users on shared/demo docs; verified-empty paid searches (UX: show count + what was scanned); fuzzy over-match on short phrases.

---

## 9. Implementation log

### M1 substrate — IMPLEMENTED (2026-06-13, TDD, pending Codex review)
Greenfield + one targeted parse fix; 37 new tests, all green; no regressions (6 unrelated pre-existing failures confirmed via stash: summary-routing / RetainPDF-sidecar / OCR-languages — env/config, not touched by this work). ruff clean. `rapidfuzz==3.13.0` added to requirements.

- **`app/services/text_normalizer.py`** (D2) — offset-preserving normalizer. Per-code-point fold (NFKC + invisible-char drop + quote/dash/ellipsis + CJK width/corner-quote fold + whitespace collapse); `fuzzy=True` adds casefold + Mn-strip. Returns `(norm, norm_to_raw)`; `raw_span()` projects a normalized span back to raw offsets so the displayed slice is always verbatim source. Tests: `tests/test_text_normalizer.py` (17).
- **`app/services/quote_verification_service.py`** (D1) — `verify_quote(proposed, source_text, *, text_quality, parse_method)` → `QuoteVerification(status, display_text, raw_start, raw_end, score, reason)`. Tiers exact→normalized→aligned(rapidfuzz `partial_ratio_alignment`); guards: min 40 chars/8 tokens, length-ratio band, low-quality/OCR cap fuzzy→flagged; exact/normalized always trusted. **Display is always the raw source slice.** Tests: `tests/test_quote_verification_service.py` (12).
- **`app/services/parse_service.py`** `_split_into_sentences` fix (Codex r2 §8.1) — ASCII `.` is a boundary only when followed by whitespace/EOS; kills `U.S.`→`U. S.`, `3.14`→`3. 14`, `e.g.`→`e. g.` corruption while preserving real-boundary and CJK splitting. Tests: `tests/test_parse_sentence_fidelity.py` (8).

**Next (not yet done):** Codex review of the substrate → then M1 remaining (PDF page-text persistence forward-only + saved-quote verification anchors are M3-adjacent) → M2 (quote-search endpoint + retrieval candidate expansion + chat-intent routing + quote-card UI). Caller of `verify_quote` must pass the cited chunk text ± retrieved neighbours (cross-chunk quotes); single-chunk verification is the unit boundary.

### M2 integration surface (scouted 2026-06-13, read-only — for fast execution after substrate review)
- Two existing routing layers detect citation intent today, both too broad for the verified pipeline:
  - `action_planner.py:68` `_CITATION_RE = (where|which page|citation|source|quote|verbatim|在哪页|引用|出处|来源|原文|定位)` → `ChatAction.CITATION_LOOKUP` (`:218`, confidence 0.78).
  - `query_router.py:318` appends `QueryIntent.CITATION_LOOKUP`; consumed by `rag_evaluator_service.py:187,239`.
- M2 must add a STRICT quote-intent matcher (Codex r1 §3: route only "direct quote / verbatim / exact quotation / quote with page", NOT broad "what is the source?"). Keep it separate from `_CITATION_RE` to avoid hijacking ordinary citation-quality questions.
- M2 quote-search flow (new, builds on M1 verify_quote): over-retrieve (~2× chat) + deterministic normalized phrase/term candidate expansion (D4/§8.3) → DeepSeek proposes quotes as JSON `{quote_text, source_ref_n, page}` (reuse extraction JSON plumbing) → `verify_quote(proposed, cited_chunk.text ± neighbours, text_quality=doc.text_quality, parse_method=doc.parse_method)` per proposal → emit verified cards in the existing citation payload shape (`chat_service.py:203-260`); display = `QuoteVerification.display_text`. Billing `reason="quote_search"` predebit 15 reconcile (§8.4.1), telemetry per §8.3.
- Frontend: quote-card list reuses citation jump (`store/index.ts:154-164` sets currentPage/highlights/highlightSnippet); "Try Quote Finder" chip on strict-intent chat messages (non-blocking, §8.4.3).

### M1 substrate — Codex review round 1 → fixes (2026-06-13)
Codex BLOCK (`.collab/reviews/2026-06-13-quote-finder-m1-codex.md`); response `.collab/dialogue/2026-06-13-quote-finder-m1-fixes.md`. Findings 1–4 fixed TDD (coverage gate on fuzzy auto-accept; `span_on_raw_boundaries` on normalized tier; `QuoteVerification.verified` contract; ASCII `?!` split rule + `_is_cjk_context` no-space-adjacent-to-CJK in `_join_text_units`). 493 passed, 0 new failures, ruff clean.
- **Finding 5 (hard-hyphen) — OPEN, M1→M2 boundary item.** Chunk-level dehyphenation is irreducibly ambiguous; the real fix is verify-against-raw-page-text (§8.1), which needs forward-only `Page.content` persistence for PDFs — and that change alters `documents.py:691 get_document_text_content` behaviour for PDFs (it prefers Page.content) + interacts with TextViewer highlighting → a separate reviewed change, NOT shipped in M1. Chunk-text verifier carries the honest "verified against extracted text" label meanwhile. **M2 must implement: (a) PDF page-text persistence, (b) verifier source = page text when present else chunk±neighbours, (c) trust labels.**
