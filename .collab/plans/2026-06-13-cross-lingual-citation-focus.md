# Cross-lingual citation focus (quote-first) — plan

**Date:** 2026-06-13
**Author:** Opus 4.8 (Fable unavailable; user authorized). Codex review mandatory before merge.
**Problem (user-reported + verified):** the lexical `focus_sentence` only narrows when the answer claim is **near-verbatim in the SAME language** as the source. Verified failures (all return None → whole-chunk highlight):
- CJK claim vs English source (中文问英文文档 — the reported case).
- Latin cross-language (Spanish claim vs English source).
- Same-language **paraphrase** ("the bank is testing an AI coder" vs "Goldman Sachs is piloting its first autonomous coder").
DocTalk's users are heavily cross-lingual → the lexical feature misses the dominant case.

## Divergent edge-case analysis (hypothesize + verify)
| # | Hypothesis | Status | Handling |
|---|---|---|---|
| H1 | CJK-claim vs Latin-source fails lexically | VERIFIED (overlap=∅) | quote-first |
| H2 | Latin cross-lang (es→en) fails lexically | VERIFIED | quote-first |
| H3 | Same-language paraphrase fails lexically | VERIFIED | quote-first |
| H4 | LLM hallucinates a quote not in source | designed | verify_quote drops → whole-chunk fallback |
| H5 | LLM quotes from a DIFFERENT chunk than [N] | designed | verify against chunk N (± its text only) → fail → fallback |
| H6 | LLM emits quote in ANSWER language not SOURCE language | designed | prompt says "verbatim in the source's language"; verify fails on mismatch → fallback |
| H7 | References/bibliography chunk (the reported doc) | acceptable | LLM picks the reference line; verbatim + correct-ish; no fabrication |
| H8 | Table/summary modality has no clean sentence | designed | excluded from focus (text modality only) |
| H9 | Cost: extra LLM call per answer | mitigated | GATED — only when ≥1 citation lacks lexical focus; uses cheap Flash model for extraction |
| H10 | Core answer-generation prompt regression | AVOIDED | extraction is a SEPARATE post-generation call — the streaming answer prompt + RefParserFSM are UNTOUCHED |
| H11 | Streaming UX (focus appears after answer) | acceptable | precedent: `answer_repaired` already updates citations post-stream |
| H12 | Numeric/date contradiction | stronger here | LLM explicitly picks the SUPPORTING sentence + we display verbatim source (no fabrication) |
| H13 | Korean Hangul / Arabic / no-space CJK source | handled | verify_quote normalizer is script-aware; LLM quotes source verbatim |
| H14 | Reload persistence | handled | enriched citations persisted to messages.citations; api.ts maps focus_snippet |

## Architecture — post-generation quote extraction (zero core-prompt change)
Chosen over inline `[N]⟪quote⟫` (touches core prompt + FSM = high regression risk) and over embedding-similarity (cheaper but can mis-pick; still needs post-stream wiring). Quote-first via a SEPARATE call is the user's choice, isolates risk, and reuses `verify_quote`.

1. **Lexical first (unchanged):** `focus_sentence` fires during streaming for same-language near-verbatim — free, fast.
2. **Quote-extraction fallback:** after generation + repair, for citations still lacking `focus_snippet`, ONE structured **Flash** LLM call: given the answer + each cited source's text, return JSON `{ref_index: verbatim_supporting_sentence_in_source_language}`. Each quote → `verify_quote(quote, chunk.text)` → if verified, set `focus_snippet = display_text`. Gated: skip the call entirely if every citation already has lexical focus or there are no text citations.
3. **Surface:** emit `sse("citations_refined", {citations})` (modeled on `answer_repaired`, text-preserving) + persist enriched citations before `done`.
4. **Frontend:** `onCitationsRefined` updates the streaming message's citations (focusSnippet now present) — `mapCitationPayload` already maps `focus_snippet`; clicking now narrows.

## Phases
- **Phase 1 (TDD, core):** `app/services/citation_quote_service.py` — `extract_focus_quotes(answer, citations, chunk_map, client, model)` async: prompt builder + JSON parse + per-quote `verify_quote` → `{ref_index: focus_snippet}`. Test with a MOCKED LLM client (verbatim quote → verified focus; hallucinated → dropped; wrong-language → dropped; gating: no call when all have focus). verify_quote is real (not mocked).
- **Phase 2 (wiring, Codex review):** call it in chat_stream after repair (both main + continuation paths), gated; emit `citations_refined`; persist. Use Flash model for the extraction call.
- **Phase 3 (frontend):** `citations_refined` SSE handler → update message citations.

## Risk / fallback
Every failure mode degrades to the current whole-chunk highlight (verify gate + gating). Core answer generation untouched. Extraction uses cheap Flash, gated to cross-lingual/paraphrase cases only.

---

## Implementation log (2026-06-13, Opus)
ALL phases implemented + TDD; Codex review launched (`.collab/reviews/2026-06-13-cross-lingual-focus-codex.md`). Uncommitted.
- **Phase 1** `app/services/citation_quote_service.py` + `tests/test_citation_quote_service.py` (6, mocked LLM): `extract_focus_quotes` (gated, tolerant JSON, per-quote verify_quote, never raises) + `apply_focus_quotes`.
- **Phase 2** `chat_service.py`: `_refine_citation_focus` helper (Flash via settings.MODE_MODELS["quick"]); called in main + continuation paths after repair, before persist; emits `citations_refined`. Fixed `test_chat_corrective_retrieval` to target the stream=True generation call (my post-gen call shifted await_args).
- **Phase 3** frontend: `onCitationsRefined` in sse.ts (`case 'citations_refined'`, text-preserving, maps focus_snippet) + `useChatStream.handleCitationsRefined` (updateLastMessageMeta citations-only), wired into chatStream + continueStream.
- Verify: 517 backend passed / 0 new failures (6 pre-existing unrelated); ruff clean; tsc + eslint clean; `npm run build` OK (414/414).
- Note: `except Exception` (3.9) does NOT catch CancelledError (BaseException) → user cancel propagates correctly.
