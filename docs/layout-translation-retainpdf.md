# Layout-Preserving PDF Translation

DocTalk now runs this feature through the RetainPDF sidecar. The previous
Datalab + PyMuPDF overlay renderer has been retired because it could produce
incomplete translations and weak page reconstruction.

## Runtime Shape

- DocTalk backend creates `document_jobs.job_type = "layout_translation"`.
- Free users get `FREE_LAYOUT_TRANSLATIONS_LIMIT` successful or active trials.
- Plus and Pro bypass the trial count, but still have page and file caps.
- The backend submits the PDF to RetainPDF's full API on port `41000`.
- RetainPDF owns OCR, translation orchestration, and translated PDF rendering.
- DocTalk owns plan gating, job records, polling, artifact storage, downloads,
  and product analytics.
- Translation uses the existing `DEEPSEEK_API_KEY` unless
  `RETAINPDF_TRANSLATION_API_KEY` is explicitly set.
- OCR provider credentials are required before jobs can start. Until then,
  `POST /api/documents/{id}/layout-translation` returns
  `LAYOUT_TRANSLATION_NOT_CONFIGURED` and does not consume a free trial.

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
RETAINPDF_OCR_PROVIDER=paddle
RETAINPDF_PADDLE_TOKEN=
RETAINPDF_MINERU_TOKEN=

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

DocTalk uses these endpoints:

- `POST /api/v1/uploads`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs/{job_id}`
- `GET /api/v1/jobs/{job_id}/pdf`
- `GET /api/v1/jobs/{job_id}/markdown?raw=true`
- `GET /api/v1/jobs/{job_id}/download`

## Cost Controls

The feature must reject expensive jobs before sidecar submission:

- Free: 2 lifetime trials, 25 pages per PDF.
- Plus: 150 pages per PDF.
- Pro: 300 pages per PDF.
- All plans: 50 MB file cap.
- Celery task time limit: 35 minutes.
- Sidecar concurrency should stay low in production until quality and OCR cost
  are validated.

## Rollout Checklist

1. Deploy or verify the `retainpdf-sidecar` Railway service.
2. Set backend `LAYOUT_TRANSLATION_ENGINE=retainpdf`.
3. Set backend `RETAINPDF_API_BASE_URL` to the Railway private sidecar URL.
4. Set backend `RETAINPDF_API_KEY` if sidecar auth is enabled.
5. Add either `RETAINPDF_PADDLE_TOKEN` or `RETAINPDF_MINERU_TOKEN`.
6. Reuse DocTalk `DEEPSEEK_API_KEY` or set `RETAINPDF_TRANSLATION_API_KEY`.
7. Run one internal PDF through the toolbar flow and confirm PDF, Markdown, and
   ZIP artifacts appear on the DocTalk artifact card.

## Notes

- Setting `LAYOUT_TRANSLATION_ENGINE` to anything other than `retainpdf` makes
  the feature report `LAYOUT_TRANSLATION_NOT_CONFIGURED`.
- Markdown and ZIP bundle artifacts are optional and are attached only when
  RetainPDF exposes those downloads.
- Celery's Redis visibility timeout must stay above the layout translation task
  time limit. The app currently uses 40 minutes for a 35 minute task cap.
