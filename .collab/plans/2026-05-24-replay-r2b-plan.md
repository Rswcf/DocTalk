# Remediation R2b + #4 — durable OCR quality trigger & language-agnostic terminology

Follow-up to R2a (deployed v0.18.2). In-prod re-replay confirmed #1/#2 fixed; #3 (U13)
and #4 residual. This plan fixes both. Branch: `feat/replay-r2b`.

## Problem (root causes, evidence-backed)

**#3 — U13 garbled (`طاغوت كا مفهوم.pdf`).** Not an image scan: it has a BROKEN-FONT text
layer (subset font, bad cmap) → text extraction yields mojibake. `detect_scanned()` is
presence-based (`>70% of pages <50 chars → scanned`); garbage-text-present ⇒ returns
False ⇒ OCR never fires. `locale="ur"` only sets the OCR *language*, doesn't *force* OCR.

Calibration (30 chunks/doc, in-prod), `lnm` = (Unicode L+N+M chars)/(non-whitespace chars):

| doc | lnm (mean) | avg token len |
|---|---|---|
| **U13 garbage** | **0.56** | **2.0** |
| PAY (Czech, good) | 0.95 | 9.2 |
| U26 (English, good) | 0.97 | 41 |
| U14 (soil, good) | 0.97 | 6.2 |
| U28 (French, good) | 0.94 | 5.6 |

Huge clean separation. `lnm` counts diacritics (č/ř/ž) as letters, so it does NOT penalise
diacritic-heavy languages (Czech scores 0.95). A mojibake-range metric WOULD (Czech moj=0.12),
so we use `lnm`, not range-counting.

**#4 — Spanish "fragmento(s)" leak.** `_output_terminology_contract()` is English-only;
DeepSeek doesn't map it to the response language. U21 (Spanish) leaked "fragmento" twice.

## Design

### R2b-1: Unicode-aware quality scoring (`parse_service.py`)
- `text_quality_score(pages) -> float`: fraction of non-whitespace chars in Unicode
  categories L*/N*/M*; `�` counts as bad. Returns 1.0 for empty (empty is
  `detect_scanned`'s job, not ours). Script-agnostic.
- `avg_token_len(pages) -> float`: mean whitespace-split token length.
- `detect_low_quality_text(pages, *, q_threshold=0.70, tok_threshold=4.0) -> (bool, float)`:
  returns `(q < q_threshold AND avgtok < tok_threshold, q)`. **AND** (two independent
  garbage signals) keeps false-positives near zero — a legitimate symbol/number-heavy doc
  (low lnm but normal token length) is NOT flagged. U13: 0.56<0.70 AND 2.0<4.0 → True.
  All good docs: lnm≥0.94 → False (never reach token check).

### R2b-1b: NARROW OCR language set (`parse_service.resolve_ocr_languages`) — NEW, critical
In-prod validation on U13's PDF (forcing OCR, measuring Arabic-script ratio):

| OCR languages | time (5p) | arabic ratio | spurious other-script letters |
|---|---|---|---|
| urd+eng+chi_sim+…+hin (13, current) | ~120s | 0.97 lnm but MIXED | high — CJK/Devanagari/Latin hallucinated (内の/पक/レンダル/désir) |
| **urd** | **9s** | **0.99** | **0.00** |
| urd+ara | 15s | 0.98 | 0.00 |

The kitchen-sink 13-language set is the root cause of poor OCR quality AND ~13× slowness:
tesseract tries to fit every script and inserts spurious glyphs. Fix: `resolve_ocr_languages`
returns a NARROW per-locale set — the locale's tesseract lang (+ `eng` for digits/embedded
Latin, unless primary is eng), filtered to installed langs (`settings.OCR_LANGUAGES` becomes
the *installed* allowlist, not the OCR set). Map: ur→urd, ar→ara, fa→fas, zh→chi_sim,
ja→jpn, ko→kor, hi→hin, es→spa, de→deu, fr→fra, pt→por, it→ita, en→eng.
Upload already threads `locale` (documents.py:452/498) so BOTH ingest and reparse narrow.
No-locale fallback (API uploads w/o locale): keep the full configured set for now (functional
but messy) — script-detection (tesseract OSD) is noted as R2c. This also resolves operational
risk #1 (9s OCR, not 120s).

### R2b-2: worker OCR trigger (`parse_worker.py`)
```
scanned = service.detect_scanned(pages)
low_q, qscore = service.detect_low_quality_text(pages) if not scanned else (False, None)
need_ocr = scanned or low_q
if need_ocr and settings.OCR_ENABLED:
    ... existing OCR path (locale-aware) ...
    parse_method = "ocr"
elif need_ocr and not OCR_ENABLED:
    ... existing OCR_DISABLED error (only for scanned; for low_q with OCR off, keep text) ...
else:
    parse_method = "text"
final_quality = text_quality_score(pages)   # of whatever we kept
```
- No OCR→re-OCR loop: after OCR we keep OCR output; existing `OCR_INSUFFICIENT_TEXT`
  guard already catches empty OCR.
- When low_q triggers OCR but OCR_ENABLED is false: do NOT hard-error (the text layer,
  while poor, is all we have) — keep text, record low quality. (Differs from the true-scan
  path, which legitimately errors as OCR_DISABLED.)

### R2b-3: durable columns (Alembic, add-only / backward-compatible)
`documents`: `parse_version INT NULL`, `parse_method VARCHAR(16) NULL`,
`text_quality DOUBLE PRECISION NULL`. Set on every parse. Module constant
`PARSE_PIPELINE_VERSION` (start at 2) bumped when parse logic changes materially.

### R2b-4: backfill finder (`backend/scripts/find_low_quality_docs.py`, read-only + opt-in)
Lists docs where `parse_version IS NULL OR parse_version < PARSE_PIPELINE_VERSION OR
text_quality < 0.70`, with `--enqueue` flag to re-dispatch `parse_document.delay(id)`
(idempotent). No new HTTP surface. Owner can also use existing `POST /documents/{id}/reprocess`.

### #4: language-agnostic terminology contract (`chat_service.py`)
Rewrite `_output_terminology_contract()` to state the prohibition applies in the RESPONSE
language and to translations, with concrete examples (es fragmento/extracto, fr extrait,
de Auszug, it frammento, pt trecho). Refer to source only as "the document"/"page N".
Test asserts it mentions translation/response-language enforcement.

## Operational risks (for Codex)
1. **Auto-OCR slowness**: ingest-time OCR on a large garbled PDF, with the 13-language
   tesseract set (no locale at ingest) is slow and may hit soft_time_limit (600s) → retry.
   Strictly better than serving garbage, but flag: should ingest OCR cap pages or narrow
   languages? (Proposed: out of scope here; note as R2c. The AND-gate makes triggers rare.)
2. **False-positive → needless OCR**: mitigated by the two-signal AND + 0.70/4.0 thresholds
   with >0.24 margin to the nearest good doc.
3. **Migration**: add-only, nullable; safe during beta. Backfill is opt-in.

## REVISIONS after Codex design review (2026-05-24, verdict REVISE → addressed)

R1. **Two-tier gate, PDF-scoped (fixes avgtok/CJK blind spot).** Only `file_type=="pdf"`
   (broken-font is PDF-specific; only PDFs are OCR-able via fitz). `detect_low_quality_text`:
   `q = text_quality_score (lnm)`; `q >= 0.75 → False` (good docs ≥0.94); `q < 0.50 → True`
   (U+FFFD×N / heavy mojibake, incl. no-space CJK garbage); ambiguous `0.50–0.75 → True` iff
   supporting evidence (`bad_char_ratio > 0.30` OR `avg_token_len < 4`). U13 q=0.56 →
   ambiguous → bad_char/short-token → True. Good CJK (q≥0.9) → False at tier-0 (never hits
   token check → no CJK false-negative). Tests: good zh/ja, no-space U+FFFD/PUA garbage, U13.

R2. **Content-based OCR language via tesseract OSD (fixes locale≠doc-language).** VERIFIED in
   container: `tesseract <png> - --psm 0` → `Script: Arabic` on U13 (no pytesseract needed —
   subprocess to `/usr/bin/tesseract`, `osd.traineddata` present). `detect_script_osd(pdf_bytes)`
   renders 1–2 sample pages → script. `resolve_ocr_languages(locale=None, script=None)`:
   script is PRIMARY (Arabic→ara+urd, Han→chi_sim, Devanagari→hin, Latin→eng+locale-latin,
   Cyrillic→…), locale REFINES within family (Arabic+ur→urd+ara; Han+ja→jpn). Low OSD
   confidence/failure → locale-narrow → configured default (last resort). Persist the resolved
   set as `documents.ocr_languages` so **retry (main.py:136 startup re-dispatch) + backfill
   reuse it without a locale**. Resolves Codex repro (en-locale user, Urdu scan → OSD→ara+urd).

R3. **Fix pre-existing R2a data-loss (Qdrant pre-delete).** Current order: DB deletes (pending)
   → Qdrant delete → on Qdrant failure `db.commit()` persists the pending Page/Chunk deletes +
   error = DATA LOSS. Fix: move the Qdrant-delete block BEFORE the four `sa_delete` statements.
   Qdrant fail → nothing deleted yet → set error + commit (pages/chunks intact, user retries).

R4. **Backfill loop guard.** `find_low_quality_docs.py` excludes `parse_method='ocr' AND
   parse_version>=PARSE_PIPELINE_VERSION` from `--enqueue` unless `--force`; requires
   `--locale`/`--languages` only for rows with no persisted `ocr_languages`.

R5. **#4 is structural — rename the prompt surface, don't just ban.** Root cause (Codex): the
   prompts themselves say "excerpt(s)"/"chunk"/"fragment" → DeepSeek translates them to
   `fragmento`/`extracto`. Fix: rename internal prompt labels to neutral "numbered sources"/
   "the document"/"page N" in `chat_service.py` + `model_profiles.py` (the `[n]` marker
   mechanism is unchanged), so the model never sees a word to translate; keep the
   language-agnostic contract as backup. (Stream sanitizer rejected: answers stream token-by-
   token, a word can span chunks → unreliable to rewrite mid-stream; removing the source word
   addresses the root instead. Flag for Codex re-review.)

## Verification
- Unit: quality/token/detect_low_quality on synthetic garbage + good strings; #4 contract.
- In-prod: reprocess U13 (now auto-OCR via low_q) → chunks lnm↑, arabic_ratio↑, replay
  U13 fail_signal → False; re-replay U21 → "fragmento" gone. No regression PAY/U26/U28/U42.
