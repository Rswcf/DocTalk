# Adversarial review: Remediation R2b + #4 design (DESIGN ONLY, no code yet)

Read `.collab/plans/2026-05-24-replay-r2b-plan.md` in full. Also read for context:
- `backend/app/services/parse_service.py` (resolve_ocr_languages:19, detect_scanned:213,
  extract_pages_ocr:152, extract_pages:109)
- `backend/app/workers/parse_worker.py` (OCR trigger ~275-317, _download_file_bytes:74)
- `backend/app/services/chat_service.py` (_output_terminology_contract — #4)

CONTEXT: R2a is deployed (v0.18.2). In-prod re-replay confirmed #1/#2 fixed. This is the
follow-up for #3 (U13 garbled Urdu) + #4 (Spanish "fragmento" leak). All findings in the
plan are EVIDENCE-BACKED from in-prod measurements (calibration table + OCR-language table
are real numbers from U13's actual PDF, not estimates).

KEY DECISIONS TO CHALLENGE:
1. Quality gate = `lnm < 0.70 AND avgtok < 4.0` (two-signal AND). Is the AND right, or does
   it create false-NEGATIVES (garbage with long tokens, or low-token good docs like CJK
   where there are no spaces → avgtok huge or tiny)? **Specifically: CJK text has few/no
   spaces — does avg_token_len break for Chinese/Japanese (one giant token → avgtok huge →
   gate never fires even if lnm low)? Is lnm-alone safer, or do we need a per-script rule?**
2. NARROW OCR language set (locale's lang + eng). Validated urd=0.99/9s vs 13-lang mixed/120s.
   Risks: (a) a doc whose CONTENT language ≠ user's UI locale (e.g. an English PDF uploaded
   by a ja-locale user → OCR with jpn+eng) — is +eng enough? (b) no-locale ingest still uses
   full set — acceptable, or must we add OSD now?
3. Auto-OCR at ingest when text present-but-low-quality: does this risk an OCR loop or
   double-cost? Any path where OCR output itself scores low_q and we can't tell?
4. Migration add-only nullable + PARSE_PIPELINE_VERSION constant + read-only backfill finder.
   Safe? Anything about idempotency / the existing Qdrant-delete precondition I'm missing?
5. #4 language-agnostic contract — prompt-only. Will listing translations actually help a
   model that ignored the English version, or is there a structural fix (post-filter)?

Be adversarial. Find the design flaw that breaks a real user. Give concrete repro inputs.
Write findings to `.collab/reviews/2026-05-24-replay-r2b-design-review.md`. Verdict:
SOUND-TO-IMPLEMENT or REVISE (with the specific revisions). Be concise.
