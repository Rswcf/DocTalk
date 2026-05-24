# R2b + #4 Implementation Review

Verdict: **BLOCK**

## Findings

1. **Must-fix: the backfill CLI does not run as documented.**  
   Repro: `cd backend && python3 scripts/find_low_quality_docs.py --help` fails with `ModuleNotFoundError: No module named 'app'`. `sys.path[0]` is `backend/scripts`, so `from app.services.parse_service import PARSE_PIPELINE_VERSION` never resolves. Fix by inserting the backend root into `sys.path`, running as a module and updating the usage, or moving the version constant to a tiny import-safe module.

2. **Must-fix: the #4 prompt rename is still incomplete in the chat answer path.**  
   `chat_service.py` still injects `get_rules_for_model(...)` into answer prompts, and `backend/app/core/model_profiles.py:30-39`, `:49-58`, `:83`, and `:92` still say `excerpt(s)` in model-facing rules. `backend/app/services/rag_evaluator_service.py:179`, `:191`, `:193`, and `:195` also say `excerpts`, and that text is injected through `chat_service._retrieval_quality_contract()` at `backend/app/services/chat_service.py:667-670`. Concrete repro: a Spanish summary or weak-retrieval answer still sees system text about "excerpts" and can produce "fragmentos/extractos" despite the later terminology contract. Rename-only is acceptable only after this full answer-generation surface is cleaned; a stream sanitizer is not a substitute for that.

3. **Must-fix: the low-quality backfill loop remains for current-version non-OCR rows.**  
   `find_low_quality_docs.py:47-49` selects any ready doc with `text_quality < threshold`, and `:60-65` skips only `parse_method='ocr'` at the current version. But `parse_worker.py:371-381` keeps the text layer when OCR fails, produces too little text, or has lower `ocr_q`, then finalizes as `parse_method='text'`, `parse_version=2`, and low `text_quality` at `:579-587`. Repro: a PDF with `q=0.45` where OCR errors or returns worse text is selected and re-enqueued forever. Low-quality non-PDF rows can also repeat because the worker never OCRs them. Persist a terminal quality state such as `ocr_rejected`/`quality_reviewed`, or have the finder skip all `parse_version >= CURRENT` automatic enqueue unless `--force`.

4. **Must-fix: no-locale retry/backfill still has the bad full-set OCR path when OSD fails.**  
   `resolve_ocr_languages(None, None)` falls back to the full `OCR_LANGUAGES` set at `parse_service.py:87-90`. Startup retry still calls `parse_document.delay(str(doc.id))` with no locale in `backend/app/main.py:136`, and the finder defaults to `locale=None` at `find_low_quality_docs.py:71`. If `detect_script_osd()` returns `None` on a sparse/cover/huge page, the worker uses the full 12-language set; for scanned docs, OCR is adopted unconditionally once it emits at least 50 chars (`parse_worker.py:362-373`). That can make mixed-script OCR terminal as `parse_method='ocr'` and then the finder skips it. Guard the no-script/no-locale case: reuse persisted `ocr_languages` when present, require `--locale`/`--languages` for automatic backfill, or fail closed for manual review instead of full-set OCR.

5. **Should-fix before fleet backfill: OSD rendering is unbounded and can OOM the worker.**  
   `detect_script_osd()` renders sampled pages with `doc[pi].get_pixmap(dpi=150)` at `parse_service.py:107` without the 20MP cap used by `extract_pages_ocr()` at `parse_service.py:326-338`. Repro shape: a 612pt x 46080pt PDF page renders at about 1275 x 96000 px at 150 DPI before Tesseract's 30s timeout can help. The temp PNG cleanup is fine and `subprocess.run([...])` is not shell-injectable, but rendering itself needs the same pixel cap or a lower bounded matrix.

6. **Should-fix: `SoftTimeLimitExceeded` can still be swallowed below the worker.**  
   The worker re-raises soft timeouts in most new blocks, but `ParseService.extract_pages_ocr()` catches broad per-page `Exception` at `parse_service.py:359-362`; if Celery raises during `page.get_textpage_ocr()`, that page is skipped and the task can continue instead of timing out. `detect_script_osd()` also has a broad `except Exception` around `fitz.open()` at `parse_service.py:98-101`. Narrow these catches or explicitly re-raise `SoftTimeLimitExceeded`.

7. **Test blocker: the targeted worker bridge test now fails before reaching OCR.**  
   `python3 -m pytest backend/tests/test_parse_quality_r2b.py backend/tests/test_parse_worker_bridge.py -q` gives 14 pass / 1 fail. `test_parse_document_uses_forwarded_locale_for_ocr` returns early in the new Qdrant pre-delete block because `embedding_service` is not mocked, so `resolver_calls == []`. Update this test to mock `ensure_collection()`, `get_qdrant_client().delete()`, `detect_script_osd()`, and the new `resolve_ocr_languages(locale, script=...)` signature.

## Revision Check

- #1 quality gate: addressed. Good no-space CJK short-circuits at `q >= 0.75`; no-space U+FFFD/PUA triggers at `q < 0.50`. The new pure tests cover this.
- #2 locale-vs-document language: partially addressed, but not sound for no-locale retry/backfill when OSD fails; see finding 4.
- #3 Qdrant cleanup ordering: addressed for the specific Qdrant-failure path. Qdrant delete now happens before DB row deletes, so that failure leaves existing pages/chunks intact. Later failures after successful cleanup are still destructive to an old ready parse, which is a residual backfill risk.
- #4 backfill loop: not fully addressed; see finding 3.
- #5 structural rename: not fully addressed; see finding 2.

## Notes

- OSD confidence `0.5` is too low to be a meaningful safety floor if it drives a narrow OCR language. Prefer a higher floor plus page agreement; if confidence is weak, return no script and avoid automatic full-set OCR.
- Importing `PARSE_PIPELINE_VERSION` from `parse_service` is acceptable inside the backend container only if the CLI import path is fixed, but it is heavier than necessary. A small `app.core.parse_pipeline` constant would make the CLI safer.
- `text_quality` is not applied to map-reduce summary contexts; finalization computes it from parsed pages. The loop risk is current-version low-quality text/non-PDF rows, not summary docs.

## Round 2

Verdict: **SHIP**

No blocking findings remain from round 1.

- #1 fixed: `scripts/find_low_quality_docs.py --help` now runs with the backend root on `sys.path`.
- #2 fixed for positive answer prompts: `model_profiles.py`, `rag_evaluator_service.py`, and the chat prompt bodies now use `source(s)`. Remaining answer-path `excerpt` strings are only forbidden-term examples in `_output_terminology_contract`, plus comments/docstrings and the internal `no_retrieved_excerpts` reason key.
- #3 fixed: the finder still lists current-version low-quality rows, but skips all `parse_version >= PARSE_PIPELINE_VERSION` automatic enqueue unless `--force`, so the re-enqueue loop is closed.
- #4 fixed for the original no-locale/OSD-fail full-set path: `resolve_ocr_languages(None, None)` falls back to `eng`, not the installed set, and low-quality text-layer OCR is adopted only if it meets the quality comparison. The scanned non-Latin + OSD-fail + no-locale case can still adopt `eng` OCR once it emits >=50 chars; acceptable residual for this round given OSD is sampled across 3 pages and U13 detects reliably. A scanned-adoption quality floor would be a reasonable hardening follow-up, but not a ship blocker.
- #5 fixed: OSD rendering is pixel-capped before Tesseract.
- #6 fixed: the new OCR/OSD catches are narrowed enough that `SoftTimeLimitExceeded` propagates.
- #7 fixed: the worker bridge test now stubs Qdrant cleanup, OSD, and the resolver signature.

Agree on leaving `main.py` startup re-dispatch as `parse_document.delay(id)` with no locale. The worker now self-detects script before resolving OCR languages, and the no-signal fallback no longer uses the dangerous full installed set.

Verification run:

- `python3 scripts/find_low_quality_docs.py --help` passed.
- `python3 -m ruff check app/services/parse_service.py app/workers/parse_worker.py scripts/find_low_quality_docs.py app/core/model_profiles.py app/services/rag_evaluator_service.py tests/test_parse_quality_r2b.py tests/test_parse_worker_bridge.py tests/test_replay_r2_helpers.py` passed.
- `python3 -m pytest tests/test_parse_quality_r2b.py tests/test_parse_worker_bridge.py tests/test_replay_r2_helpers.py tests/test_rag_evaluator_service.py tests/test_parse_service.py -q` passed: 44 tests.
