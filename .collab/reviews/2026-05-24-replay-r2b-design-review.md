# R2b Design Review

Verdict: **REVISE**

## Findings

1. **Must-fix: the `lnm < 0.70 AND avgtok < 4.0` gate misses no-space garbage.**  
   `avg_token_len` is whitespace-based, so a broken CJK/Japanese/Korean text layer, or any mojibake emitted as one long run, becomes one giant token and suppresses OCR exactly when `lnm` says the text is bad. Concrete repro: one PDF page extracts a single block of `"\ufffd" * 800`, `"\ue000" * 800`, or `"□□□□" * 800`. `detect_scanned()` is false because length > 50; `lnm` is near 0; `avgtok` is 800; low-quality detection returns false; OCR never runs. Good CJK text has high `lnm`, so low `lnm` plus no spaces should trigger OCR, not block it.  
   **Revise:** use a two-tier/per-script rule: e.g. `lnm < 0.55` always triggers; `0.55 <= lnm < 0.70` triggers with supporting evidence such as short tokens, very low space density plus high bad-char ratio, or high replacement/private-use/symbol/control ratio. Add tests for good Chinese/Japanese text and no-space U+FFFD/PUA garbage.

2. **Must-fix: locale-narrow OCR is not safe because UI locale is not document language, and retry/backfill lose the locale.**  
   `locale + eng` works for U13 only because the UI locale matches the document. Real repro: an English-locale or API/no-locale user uploads an Urdu/Arabic/Hindi scanned PDF; `resolve_ocr_languages("en")` becomes `eng` only, so OCR fails or hallucinates Latin. Another repro is the proposed backfill itself: `find_low_quality_docs.py --enqueue` calls `parse_document.delay(id)` with no locale, so old U13-like docs use the full 13-language set and reproduce the 120s/mixed-script failure. Startup stuck-doc retry also re-dispatches without locale (`backend/app/main.py:136`).  
   **Revise:** persist the parse locale/OCR language decision on `documents`, or add a durable `ocr_languages`/`parse_locale` column and reuse it for retries and backfills. For old rows, make backfill accept or require `--locale`/`--languages` until script detection exists. Add a cheap OSD/sample-OCR fallback now for no-locale and `en`-locale non-Latin scans, or choose a narrow script-family set from detected script rather than UI locale alone.

3. **Must-fix: the existing Qdrant pre-delete precondition can still commit DB data loss on cleanup failure.**  
   `parse_worker.py` deletes `DocumentBrief`, `DocumentElement`, `Chunk`, and `Page` rows before Qdrant cleanup, then commits inside the Qdrant failure path after setting the document error (`backend/app/workers/parse_worker.py:141-173`). A Qdrant outage during reparse/backfill therefore leaves the document `error`, deletes DB pages/chunks, and leaves stale vectors. Fleet backfill increases this blast radius.  
   **Revise:** move Qdrant delete before DB deletes, or explicitly `rollback()` pending DB deletes on Qdrant cleanup failure. Do not ship opt-in mass backfill until this is fixed.

4. **Should-fix: OCR-low-quality output becomes an expensive re-enqueue loop.**  
   The worker will not OCR twice in one task, but the finder selects `text_quality < 0.70` unconditionally. If OCR output is still poor but > 50 chars, the doc becomes ready with `parse_method="ocr"` and low quality, then `--enqueue` will reprocess it forever.  
   **Revise:** exclude `parse_method='ocr' AND parse_version >= PARSE_PIPELINE_VERSION` from automatic enqueue unless `--force`, or persist a terminal quality status such as `ocr_low_quality` for manual review.

5. **Must-fix for #4: a prompt-only translation ban is fighting the rest of the prompt.**  
   The main and repair prompts still say "document excerpts", "excerpt numbers", and "retrieved document excerpts" repeatedly (`chat_service.py` and `model_profiles.py`). In a Spanish answer, DeepSeek can translate those prompt terms to `fragmento`/`extracto` while otherwise obeying the task. Adding more translated examples helps, but it is not structural. Concrete repro: Spanish user asks "resume el documento"; the system prompt contains "Document Excerpts" and "excerpt numbers"; the model replies "segun los fragmentos/extractos..." despite a final terminology ban.  
   **Revise:** rename the internal prompt surface consistently to neutral labels such as "numbered sources" or "numbered evidence items"; remove "excerpt/chunk/fragment" from answer-generation rules where possible. Add a final terminology repair/sanitizer for supported locales that rewrites boilerplate like Spanish `fragmento(s)`/`extracto(s)` to `documento`, `texto`, or `secciones`, while not touching quoted source text.

## Sound Parts

- `lnm` is the right base signal; Unicode L/N/M handles CJK, Arabic, Devanagari, and diacritics better than range-counting.
- Add-only nullable columns plus `PARSE_PIPELINE_VERSION` are migration-safe if Alembic runs before the new worker model is used.
- Auto-OCR is not an in-task OCR loop if the low-quality decision is computed once before OCR; the loop risk is in backfill/retry policy, not the worker branch itself.
