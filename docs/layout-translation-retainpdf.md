# Layout-Preserving PDF Translation

DocTalk runs this feature with a Datalab-first OCR/layout path. The product API
owns quota, plan gating, job records, artifact storage, translation, and
downloads. Datalab owns document conversion/layout parsing; DocTalk renders the
translated PDF with PyMuPDF. RetainPDF remains available as a sidecar fallback.

## Runtime Shape

- DocTalk backend creates `document_jobs.job_type = "layout_translation"`.
- Free users get `FREE_LAYOUT_TRANSLATIONS_LIMIT` successful or active trials.
- Plus and Pro bypass the trial cap.
- Translation uses the existing `DEEPSEEK_API_KEY` unless
  `RETAINPDF_TRANSLATION_API_KEY` is explicitly set.
- OCR/layout provider credentials are required before jobs can start. Until then,
  `POST /api/documents/{id}/layout-translation` returns
  `LAYOUT_TRANSLATION_NOT_CONFIGURED` and does not consume a free trial.

## Required Environment

```bash
FREE_LAYOUT_TRANSLATIONS_LIMIT=2
FREE_LAYOUT_TRANSLATION_MAX_PAGES=25
PLUS_LAYOUT_TRANSLATION_MAX_PAGES=150
PRO_LAYOUT_TRANSLATION_MAX_PAGES=300
LAYOUT_TRANSLATION_MAX_FILE_SIZE_MB=50
LAYOUT_TRANSLATION_ENGINE=datalab

# Datalab conversion API. Put the production key in Railway backend variables;
# for local dev, put it in backend/.env or repo .env.
DATALAB_API_BASE_URL=https://www.datalab.to/api/v1
DATALAB_API_KEY=...
DATALAB_CONVERT_MODE=balanced
DATALAB_OUTPUT_FORMAT=json,markdown
DATALAB_EXTRAS=
DATALAB_WORD_BBOXES=false

# DeepSeek remains the default translation backend.
DEEPSEEK_API_KEY=...
RETAINPDF_TRANSLATION_API_KEY=
RETAINPDF_TRANSLATION_BASE_URL=https://api.deepseek.com/v1
RETAINPDF_TRANSLATION_MODEL=deepseek-v4-flash

RETAINPDF_POLL_INTERVAL_SECONDS=5
RETAINPDF_TIMEOUT_SECONDS=1800
```

## Datalab Flow

1. DocTalk submits the source PDF to `POST /api/v1/convert` with
   `output_format=json,markdown` and `mode=balanced`.
2. The worker polls Datalab's `request_check_url` until `status=complete`.
3. The worker extracts block-level text and bounding boxes from Datalab JSON.
4. DeepSeek translates the blocks to Simplified Chinese.
5. PyMuPDF overlays translated text into the original page boxes and stores PDF,
   Markdown, and ZIP artifacts.

The ZIP bundle contains `datalab-result.json` and `translated-blocks.json` so
the first production samples can be inspected and used to tighten the Datalab
adapter.

## RetainPDF Fallback

Set `LAYOUT_TRANSLATION_ENGINE=retainpdf` to use the sidecar path.

```bash
# RetainPDF full Rust API, normally port 41000 from its Docker delivery setup.
RETAINPDF_API_BASE_URL=http://localhost:41000
RETAINPDF_API_KEY=

RETAINPDF_OCR_PROVIDER=paddle
RETAINPDF_PADDLE_TOKEN=
RETAINPDF_MINERU_TOKEN=
RETAINPDF_WORKERS=0
RETAINPDF_BATCH_SIZE=1
RETAINPDF_CLASSIFY_BATCH_SIZE=12
RETAINPDF_COMPILE_WORKERS=0
```

RetainPDF's Docker delivery exposes:

- `40001`: RetainPDF web UI
- `41000`: full Rust API used by DocTalk
- `42000`: simplified multipart async API

DocTalk should point `RETAINPDF_API_BASE_URL` at the full API on `41000`.

Minimal sidecar smoke test:

```bash
curl "$RETAINPDF_API_BASE_URL/health"
```

## Rollout Checklist

1. Add `DATALAB_API_KEY` to the Railway backend service.
2. Keep `LAYOUT_TRANSLATION_ENGINE=datalab`.
3. Reuse DocTalk `DEEPSEEK_API_KEY` for translation.
4. Run one internal PDF through the toolbar flow and confirm PDF, Markdown, and
   ZIP artifacts appear on the DocTalk artifact card.
5. Inspect `translated-blocks.json` for bbox quality and skipped blocks.
6. After quality/cost validation, decide whether to keep PDF-to-Chinese only or
   add more target languages.

## Notes

- The Datalab path currently overlays translated text into detected boxes. It is
  the production-default MVP, not the final high-fidelity renderer.
- The RetainPDF fallback still downloads the translated PDF after RetainPDF
  reports success. Markdown and bundle artifacts are optional and are attached
  only when RetainPDF exposes those downloads.
- Celery's Redis visibility timeout must stay above the layout translation task
  time limit. The app currently uses 40 minutes for a 35 minute task cap.
