# Layout-Preserving PDF Translation

DocTalk runs layout-preserving PDF translation through the RetainPDF sidecar.
The previous Datalab + PyMuPDF overlay renderer is retired because it produced
incomplete translations, duplicated source/target text, and weak page
reconstruction on real documents.

This is a parallel document capability, not a required upload step. Users can
continue using normal document chat without translating the PDF. When they need
a translated PDF, they open the translation drawer from the reader toolbar,
choose the target language, and decide whether the translated result should
also become a new DocTalk document.

## Product Flow

1. User opens an existing PDF document in DocTalk.
2. User clicks the layout translation action in the PDF toolbar.
3. Drawer asks for target language and an optional "add as new DocTalk
   document" choice. The job is not submitted until the user confirms.
4. Backend creates `document_jobs.job_type = "layout_translation"` and checks
   plan, page, file-size, ownership, and RetainPDF configuration before any
   sidecar call.
5. Celery submits the source PDF to RetainPDF's full API on port `41000`.
6. RetainPDF owns OCR, translation orchestration, and translated PDF rendering.
7. DocTalk polls the job and stores the translated PDF, Markdown, and optional
   bundle artifacts in MinIO.
8. The chat artifact card lets the user preview the translated PDF in the right
   reader, download PDF/Markdown/bundle files, and optionally import the
   translated PDF as a new DocTalk document.
9. If imported, DocTalk creates a new document record and starts the normal
   parse/index pipeline for chat with the translated document.

## Runtime Ownership

- DocTalk owns product gating, job records, polling, artifact persistence,
  download URLs, preview URLs, optional document import, and analytics.
- RetainPDF owns OCR selection, translation batching, output layout rendering,
  and artifact generation.
- DeepSeek remains the default translation backend. DocTalk reuses
  `DEEPSEEK_API_KEY` unless `RETAINPDF_TRANSLATION_API_KEY` is set.
- OCR provider credentials are required before jobs can start. Until configured,
  `POST /api/documents/{id}/layout-translation` returns
  `LAYOUT_TRANSLATION_NOT_CONFIGURED` and does not consume a free trial.

## API Contract

### Create Translation Job

`POST /api/documents/{document_id}/layout-translation`

Request body:

```json
{
  "target_language": "zh-CN",
  "locale": "en",
  "add_to_library": false
}
```

`target_language` accepts:

- `zh-CN` Chinese
- `en` English
- `ja` Japanese
- `ko` Korean
- `es` Spanish
- `de` German
- `fr` French
- `pt` Portuguese
- `it` Italian
- `ar` Arabic
- `hi` Hindi

`add_to_library` records the user's intent to create a new DocTalk document
after the translation succeeds. The frontend can also call the import endpoint
later from the artifact card.

### Download Artifacts

`GET /api/layout-translations/{job_id}/download?artifact=pdf|markdown|bundle`

The endpoint streams the chosen artifact from DocTalk storage after ownership
checks. Markdown and bundle downloads appear only if RetainPDF produced them.

### Import Translated PDF

`POST /api/layout-translations/{job_id}/import-document`

Creates a new DocTalk document from the translated PDF artifact and starts the
standard parse pipeline. This endpoint still respects per-plan document count
limits.

## Required Environment

```bash
FREE_LAYOUT_TRANSLATIONS_LIMIT=2
FREE_LAYOUT_TRANSLATION_MAX_PAGES=25
PLUS_LAYOUT_TRANSLATION_MAX_PAGES=150
PRO_LAYOUT_TRANSLATION_MAX_PAGES=300
LAYOUT_TRANSLATION_MAX_FILE_SIZE_MB=50
LAYOUT_TRANSLATION_ENGINE=retainpdf

# RetainPDF full Rust API. In Railway production this should use the private
# service URL, for example http://retainpdf-sidecar.railway.internal:41000.
RETAINPDF_API_BASE_URL=http://localhost:41000
RETAINPDF_API_KEY=

# Choose exactly one configured OCR provider.
RETAINPDF_OCR_PROVIDER=datalab
RETAINPDF_PADDLE_TOKEN=
RETAINPDF_MINERU_TOKEN=
RETAINPDF_DATALAB_TOKEN=
RETAINPDF_DATALAB_API_URL=https://www.datalab.to
RETAINPDF_DATALAB_MODE=balanced
RETAINPDF_DATALAB_OUTPUT_FORMAT=json,markdown

# DeepSeek remains the default translation backend.
DEEPSEEK_API_KEY=
RETAINPDF_TRANSLATION_API_KEY=
RETAINPDF_TRANSLATION_BASE_URL=https://api.deepseek.com/v1
RETAINPDF_TRANSLATION_MODEL=deepseek-v4-flash

RETAINPDF_POLL_INTERVAL_SECONDS=5
RETAINPDF_TIMEOUT_SECONDS=1800
RETAINPDF_WORKERS=0
RETAINPDF_BATCH_SIZE=1
RETAINPDF_CLASSIFY_BATCH_SIZE=12
RETAINPDF_COMPILE_WORKERS=0
```

## Sidecar API

RetainPDF's Docker delivery exposes:

- `40001`: RetainPDF web UI
- `41000`: full Rust API used by DocTalk
- `42000`: simplified multipart async API

DocTalk points `RETAINPDF_API_BASE_URL` at the full API on `41000`.

Minimal sidecar smoke test:

```bash
curl "$RETAINPDF_API_BASE_URL/health"
```

DocTalk uses these RetainPDF endpoints:

- `POST /api/v1/uploads`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs/{job_id}`
- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/markdown?raw=true`
- `GET /api/v1/jobs/{job_id}/download`

## Cost Controls

The feature must reject expensive jobs before sidecar submission:

- Free: 2 lifetime successful or active trials, 25 pages per PDF.
- Plus: 150 pages per PDF.
- Pro: 300 pages per PDF.
- All plans: 50 MB layout-translation file cap.
- Optional import as a new DocTalk document must pass the user's document count
  limit before creating the new document.
- Celery task time limit: 35 minutes.
- Sidecar concurrency should stay low in production until quality, queue time,
  OCR spend, and translation spend are validated.

These limits are cost controls, not only UX rules. Do not bypass them from
frontend-only checks.

## Quality Scope

Use marketing language carefully:

- Best fit: text-heavy papers, contracts, manuals, filings, reports, and
  articles where most content is linear text.
- Good but review-required: mixed documents with figures, formulas, tables, or
  multi-column layout.
- High-risk: table-heavy bills, invoices, forms, dense financial statements,
  stamps, handwritten scans, and documents with unusual embedded fonts.

The product should not promise 100% translation coverage or perfect table/form
reconstruction. Users should preview the translated PDF before relying on it.

## Rollout Checklist

1. Deploy or verify the `retainpdf-sidecar` Railway service.
2. Confirm `curl "$RETAINPDF_API_BASE_URL/health"` returns healthy from the
   backend network path.
3. Set backend `LAYOUT_TRANSLATION_ENGINE=retainpdf`.
4. Set backend `RETAINPDF_API_BASE_URL` to the Railway private sidecar URL.
5. Set backend `RETAINPDF_API_KEY` if sidecar auth is enabled.
6. Add `RETAINPDF_DATALAB_TOKEN`, `RETAINPDF_PADDLE_TOKEN`, or
   `RETAINPDF_MINERU_TOKEN` for the selected `RETAINPDF_OCR_PROVIDER`. Datalab
   can also reuse `DATALAB_API_KEY` when `RETAINPDF_DATALAB_TOKEN` is empty.
7. Reuse DocTalk `DEEPSEEK_API_KEY` or set `RETAINPDF_TRANSLATION_API_KEY`.
8. Open a small internal PDF in DocTalk and confirm the drawer shows all target
   languages.
9. Run a translation and confirm the artifact card shows status, preview,
   download, and optional import actions.
10. Preview the translated PDF in the right reader and toggle back to the
    original.
11. Import the translated PDF as a new DocTalk document and confirm the normal
    parse pipeline completes.
12. Check Railway logs for sidecar errors, backend structured failures, timeouts,
    and repeated retries.

## Notes

- Setting `LAYOUT_TRANSLATION_ENGINE` to anything other than `retainpdf` makes
  the feature report `LAYOUT_TRANSLATION_NOT_CONFIGURED`.
- Markdown and ZIP bundle artifacts are optional and are attached only when
  RetainPDF exposes those downloads.
- Celery's Redis visibility timeout must stay above the layout translation task
  time limit. The app currently uses 40 minutes for a 35 minute task cap.

## 2026-09-13 local QA candidate: substantive footnotes

A real six-page public court filing exposed an upstream Paddle policy gap:
`p005-b0010` was recognized as a footnote, but normalized with
`policy.translate=false` / `provider_non_body:footnote`. It never entered the
translation model and remained English in the rendered Chinese PDF. The prior
job and output are retained as evidence. A successful job status alone does not
establish translation completeness or terminology accuracy.

`infra/retainpdf/Dockerfile` builds from the inspected immutable upstream image
and applies a single checked policy replacement to include recognized ordinary
Paddle footnotes. The image runs as the upstream `retainpdf:retainpdf` user;
root is used only during the build to patch the source copy and the installed Python package. The entry point imports the installed wheel, so modifying only `/app/services/pipeline` has no runtime effect. The build imports the installed module and asserts its footnote policy.
Headers, references, and non-text blocks keep their previous policy. The patch
fails if the expected upstream implementation changes. This is a local QA
candidate, not an instruction to deploy or an assertion that production uses
this image. Preserve the configured `RUST_API_ROOT` and mount `auth.local.json`
under that same root; mismatched paths correctly prevent startup.

DocTalk's translation rules also clarify domain terminology and require
substantive footnote prose to be translated. Legal dismissal terminology must
preserve the distinction described in the [US Courts glossary](https://www.uscourts.gov/glossary),
including qualifications about limitations periods. General language rules do
not replace domain review and cannot repair blocks excluded before translation.

Actual browser preview of local job `c8145a3a-f529-4bda-a18c-5e2b528c72be` confirms a translated page-5 footnote, six retained pages, and no visible overlap there. The Simplified Chinese glossary applies only near dismissal wording and does not guarantee complete terminology coverage: a page-3 phrase still used a literal bias translation. Treat this as a coverage fix with an open terminology issue, pending independent review.


Final local retest `74b10882-964f-41c0-948b-88dbf59fc71b` corrected the page-3 terminology and retained the translated page-5 footnote and six-page layout. The two Simplified Chinese dismissal entries remain context-restricted; `glossary_mode=all` keeps them available across joined paragraphs, and explicit translation rules are derived from the same entries. This also distinguishes the semantic request from older upstream unit-cache entries (mode alone is not in the unit-cache key). The prior failed mode-only job is preserved. No cache was purged and no further upstream pipeline patch was added. See the real PDF QA report for screenshots, failed intermediate runs and limits; review and production rollout are separate gates.


2026-09-13 independent review follow-up (local, not deployed):
`RETAINPDF_CONTEXTUAL_GLOSSARY_ENABLED` defaults to `false`. Enable it only after
confirming the installed sidecar's contextual matching contract. The pinned
Dockerfile now executes `verify_contract.py` against the actual installed wheel:
both court-dismissal terms are protected, qualifications remain, and unrelated
settlement-letter text is not hard-replaced. The local contract image
`doctalk-retainpdf:reviewed-contract-20260913` built successfully (manifest
`e8959e78d300b98b3fe9868827af68029e2fd82484dd6ef1e5d951268c81c24b`).
The earlier six-page visual regression ran on the equivalent footnote-policy image;
this added build step validates compatibility and does not change OCR/translation
code. Production image/configuration and end-to-end output remain unverified.


### 2026-09-13 production image rollout

The reviewed footnote/context-contract image is now deployed as Railway
`d968faad-6959-497a-8082-8d40daf6520d`. Actual-container validation confirmed
UID/GID10001, us-west2, authenticated API and `/health`200, translated footnote
policy, and the installed contextual glossary assertions. A one-time ownership
migration was required for the legacy root-owned `/data` volume; it preserved
files and permissions and is absent from the final application image. Railway
healthchecks require explicit `PORT=41000` alongside `RUST_API_PORT=41000`.
The backend contextual glossary switch is enabled only after this validation.
Document-specific end-to-end production output is recorded in the release
acceptance report; the earlier local output is not evidence of every production
translation being linguistically correct.
