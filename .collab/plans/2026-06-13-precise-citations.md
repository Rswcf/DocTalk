# Precise (sentence-level) citation highlighting — plan

**Date:** 2026-06-13
**Author:** Opus 4.8 (Fable temporarily unavailable; user explicitly authorized Opus to author this plan — normal rule is Fable plans).
**Status:** DRAFT → implement Phase 1 (TDD) → Codex review before any deploy.

## Problem (user-reported, verified in code)
Clicking a chat citation highlights the WHOLE cited chunk. `chat_service.py:242` puts every line bbox of the chunk into `bboxes`; `text_snippet` (`:243`) is just the first 100 chars of the chunk. The frontend (`PageWithHighlights.tsx`) renders all chunk line-rects, and its text-layer snippet highlight only fires for `allDummy` (converted PPTX/DOCX) bboxes. Chunks are 150–300 tokens, so when the answer is supported by ONE sentence, the whole block lights up → feels imprecise.

## Approach — narrow the highlight to the supporting sentence; do NOT shrink chunks
Reuse the answer-claim signal already flowing through the citation paths to pick the best-supported sentence inside the cited chunk, and highlight just that. Conservative: narrow only when one sentence clearly dominates, else keep whole-chunk (precision improves or stays equal, never worse). Works on existing docs via the frontend text-layer snippet path (no reparse).

### Signal source (no external threading, no LLM prompt change)
- **Streaming path** (`RefParserFSM.feed`, the primary path): the FSM already receives the answer token stream. Add a rolling `recent_claim` buffer (recent answer text, reset on sentence end). When `[N]` is parsed, that buffer is the claim being cited.
- **Fallback path** (`:345`): `anchor_text` (answer text around the citation) is already computed — use it directly.
Both = "the answer claim near the citation." `_text_features` (latin words + CJK chars/bigrams) is the existing lexical signal; the focus function uses the same idea (self-contained to avoid a circular import).

## Phases
### Phase 1 — `app/services/citation_focus_service.py` (pure logic, TDD) ✅ this increment
`focus_sentence(chunk_text, claim_text, *, min_overlap=2, min_chunk_chars=80, dominance=1.5) -> str | None`
- Split chunk into sentences; score each by feature-overlap with claim_text; return the best **verbatim** sentence iff: chunk ≥ min_chunk_chars AND ≥2 sentences AND best overlap ≥ min_overlap AND best ≥ runner-up × dominance. Else None.
- Self-contained tokenizer (latin `\w` + CJK chars/bigrams); sentence splitter mirrors the parse boundary rule (ASCII .?! followed by ws/EOS; CJK 。！？；).

### Phase 2 — wire into citation assembly (Codex review before merge)
- `RefParserFSM`: add `recent_claim` rolling buffer; pass to `_citation_payload`.
- `_citation_payload(ref_num, chunk, offset, claim_text="")`: when `focus_sentence(chunk.text, claim_text)` returns a sentence, set `text_snippet` to it (verbatim); else keep current first-100 behavior. bboxes unchanged (frontend narrows via snippet).
- Fallback caller: pass `anchor_text`.

### Phase 3 — frontend (Codex review before merge)
- `PageWithHighlights`: when `highlightSnippet` is present and found on the page text layer, highlight that sentence as the PRIMARY highlight for normal PDFs too (not just allDummy); render the chunk bboxes as a fainter context shade. Fall back to chunk bboxes when no text-layer match (scanned/bbox-only).

## Out of scope (later)
- Span→bbox parse-time char ranges (precise rects for scanned/bbox-only docs) — robustness upgrade, forward-only.
- Quote-first LLM emission of the exact supporting quote — higher accuracy, but touches the core prompt/parser; revisit if the lexical heuristic underperforms.

## Risk / fallback
Heuristic may pick the wrong sentence → mitigated by the conservative dominance gate (ambiguous → whole-chunk). Worst case = today's behavior. FSM buffer change is contained + unit-tested. No prompt change. No migration.

---

## Implementation log (2026-06-13, Opus — Fable unavailable)
ALL 3 phases implemented + TDD; Codex review launched (`.collab/reviews/2026-06-13-precise-citations-codex.md`). Uncommitted.
- **Phase 1** `app/services/citation_focus_service.py` + `tests/test_citation_focus_service.py` (8). `focus_sentence` conservative (script-agnostic: gate on sentence ≤70% of chunk, not a char floor — CJK is dense).
- **Phase 2** `chat_service.py`: `_citation_payload(…, claim_text="")` sets `focus_snippet`; `RefParserFSM` rolling `recent_claim` (200-char window, per-answer — verified fresh FSM at :364/:1609/:2281, no cross-answer leak); fallback passes `anchor_text`. `tests/test_citation_focus_wiring.py` (3).
- **Phase 3** frontend: `focus_snippet` threaded sse.ts/api.ts/types/store/DocumentReaderPageClient/PdfViewer/PageWithHighlights. New store field `highlightFocus`. PageWithHighlights highlights the focus sentence on any PDF (suppresses whole-chunk bbox text-marking via `!focusActive`, dims chunk overlay to 0.35 opacity as context); allDummy fallback unchanged; no-focus path unchanged (no regression).
- Verify: 504 backend passed (+11 new) / 0 new failures (6 pre-existing unrelated); ruff clean; tsc + eslint clean; `npm run build` OK (414/414).
- Known design choice (Codex to confirm): if the focus sentence can't be matched on the PDF text layer, the chunk box still shows at 0.35 opacity (degraded, not empty). `focus_snippet` persistence in messages.citations to confirm.
