# Round 2 — verify R2b + #4 blocker fixes

Your round-1 impl review was BLOCK with 7 findings. All addressed in commits up to 1eef745.
Updated diff: `.collab/reviews/2026-05-24-replay-r2b-impl-diff.patch`. Read the changed files.

How each was fixed:
1. CLI ModuleNotFoundError → `sys.path.insert(0, backend_root)` before `app` imports in
   `scripts/find_low_quality_docs.py`. (Verified `--help` runs.)
2. #4 rename incomplete → renamed model-facing "excerpt"→"source" in
   `app/core/model_profiles.py` (all rule strings) and `app/services/rag_evaluator_service.py`
   prompt strings (kept internal reason key `no_retrieved_excerpts`). Confirm no model-facing
   "excerpt" remains in the answer-generation surface.
3. backfill loop → `find_low_quality_docs.py` now skips ALL `parse_version >= CURRENT` unless
   `--force` (not just OCR'd). Current-version low-quality rows are listed, not auto-enqueued.
4. no-locale/OSD-fail full-set OCR → `resolve_ocr_languages` no-signal fallback is now "eng"
   (not the installed set). For a non-Latin doc, eng OCR yields low quality → worker's
   adopt-only-if `ocr_q >= text-layer q` guard rejects it → keeps the text layer. Confirm this
   closes the mixed-script-terminal path. (Residual: a SCANNED non-Latin doc where OSD fails →
   eng OCR adopted unconditionally at ≥50 chars. OSD detected U13 reliably; is the eng fallback
   acceptable for this rare case, or do you want a quality floor on scanned adoption too?)
5. OSD OOM → `detect_script_osd` pixel-caps rendering at 20MP (eff_dpi downscale).
6. SoftTimeLimitExceeded → narrowed per-page catches in `extract_pages_ocr` and
   `detect_script_osd` to (SubprocessError/OSError/RuntimeError/ValueError/MemoryError);
   `fitz.open` catch narrowed; OSD confidence floor raised to 1.0, sample 3 pages.
7. bridge test → mocks embedding_service + detect_script_osd + new resolver signature; passes.

Also confirm: I did NOT change main.py:136 startup re-dispatch (parse_document.delay(id), no
locale) — OSD self-detects script so retries are correct; agree?

58 tests pass, ruff clean. Final verdict: SHIP or BLOCK (concrete). Append "## Round 2" to
`.collab/reviews/2026-05-24-replay-r2b-impl-review.md`. Concise.
