# Adversarial review: R2b + #4 IMPLEMENTATION (code)

Branch `feat/replay-r2b`, commit 8162721. Full diff: `.collab/reviews/2026-05-24-replay-r2b-impl-diff.patch`.
This implements the design you reviewed (REVISE) — verify the 5 revisions were correctly
addressed and find new bugs. Read the actual files (not just the diff):
- `backend/app/services/parse_service.py` (text_quality_score, _avg_token_len, _bad_char_ratio,
  detect_low_quality_text, detect_script_osd, resolve_ocr_languages, PARSE_PIPELINE_VERSION)
- `backend/app/workers/parse_worker.py` (Qdrant-delete moved before DB deletes; new OCR
  trigger scanned OR low_q; OSD language selection; adopt-OCR-only-if-better; finalization
  persists parse_version/parse_method/text_quality/ocr_languages)
- `backend/app/services/chat_service.py` (excerpt→source rename; _output_terminology_contract)
- `backend/alembic/versions/20260524_0032_*` (add-only nullable columns)
- `backend/scripts/find_low_quality_docs.py`
- `backend/app/models/tables.py`

Your 5 design findings + how I addressed them:
1. avgtok/CJK blind spot → two-tier PDF-scoped gate (q>=0.75 ok / q<0.50 garbage / ambiguous
   needs bad_char_ratio>0.30 OR avgtok<4). Verify CJK good text (q high) short-circuits and
   no-space U+FFFD garbage (q<0.50) triggers.
2. locale≠doc-language + retry/backfill lose locale → detect_script_osd (content-based, via
   subprocess tesseract --psm 0; pytesseract NOT installed) drives resolve_ocr_languages;
   locale only refines. NOTE: I did NOT change main.py startup re-dispatch (line ~136,
   parse_document.delay(id) with no locale) because OSD now self-detects script → retries are
   correct without locale. Is that reasoning sound, or is there a path where OSD fails AND no
   locale → bad full-set OCR that I should guard?
3. data-loss → Qdrant delete moved BEFORE the four sa_delete. Verify the failure path leaves
   Pages/Chunks intact.
4. backfill loop → finder skips parse_method='ocr' AND parse_version>=CURRENT unless --force;
   worker adopts OCR only if ocr_q >= text-layer q. Any remaining loop/cost path?
5. #4 structural → renamed model-facing "excerpt"→"source" in ALL answer-gen/repair/citation/
   source-location prompts (I scoped to chat_service.py only, NOT extraction/diff/brief
   services — those aren't the chat answer path). Rejected a stream sanitizer (answers stream
   token-by-token; a word spans chunks → unreliable). Accept the rename-only approach, or is
   the sanitizer still needed?

ALSO scrutinize: detect_script_osd renders pages to /tmp PNG + subprocess with timeout=30 —
resource/cleanup/security concerns? OSD confidence floor 0.5 — too low? The PARSE_PIPELINE_VERSION
in find_low_quality_docs imports from parse_service (which imports fitz) — ok for a CLI? Any
SoftTimeLimitExceeded escape the new try/excepts? text_quality on map-reduce summary docs?

Be adversarial, concrete repro inputs. Write to `.collab/reviews/2026-05-24-replay-r2b-impl-review.md`.
Verdict: SHIP or BLOCK (with specific fixes). Concise.
