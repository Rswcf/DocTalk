# QA Run - Production Current Demo Reader UX - 2026-05-11

Scope: rerun the public production demo reader direct citation-highlight browser UX check against the currently deployed site, before local frontend fixes are deployed. This is a production baseline, not a post-fix pass.

## Environment

| Item | Value |
|---|---|
| Frontend | `https://www.doctalk.site` |
| Backend | `https://backend-production-a62e.up.railway.app` |
| Harness | `.collab/scripts/qa_production_demo_reader_ux.js` |
| Evidence | `.collab/tasks/qa-production-current-demo-reader-ux-2026-05-11.json` |
| Screenshots | `.collab/tasks/screenshots/2026-05-11-production-current/demo-reader/` |
| Mock session | `false` |

## Command

```bash
node .collab/scripts/qa_production_demo_reader_ux.js \
  --base-url https://www.doctalk.site \
  --backend https://backend-production-a62e.up.railway.app \
  --json-out .collab/tasks/qa-production-current-demo-reader-ux-2026-05-11.json \
  --screenshot-dir .collab/tasks/screenshots/2026-05-11-production-current/demo-reader
```

## Result

Overall: **fail**.

```json
{
  "desktop_result": "fail",
  "mobile_result": "fail",
  "selected_slug": "alphabet-earnings",
  "document_id": "d949b371-8934-49e2-80d7-96d033bf1217",
  "target_page": 10,
  "target_chunk_id": "f0575969-3cc0-44da-a60c-0e8d91e7659f",
  "desktop_canvas_count": 15,
  "mobile_canvas_count": 11,
  "desktop_overlay_count": 66,
  "mobile_overlay_count": 66,
  "desktop_console_errors": 0,
  "mobile_console_errors": 0,
  "desktop_chat_requests": 0,
  "mobile_chat_requests": 0,
  "deleted_sessions": [204, 204]
}
```

## Findings

Desktop reached the reader URL with `200`, rendered the PDF and 66 citation overlay nodes, showed page input value `10`, created no `/chat` requests, and cleaned the anonymous demo session with `204`. It failed because the target page and overlays remained far below the viewport: the target page rect top was about `4611px`, and the first overlay rects were around `5146px`.

Mobile reached the reader URL with `200`, selected the `Document` tab, rendered the PDF and 66 citation overlay nodes, showed page input value `10`, created no `/chat` requests, and cleaned the anonymous demo session with `204`. It failed because the target overlay rects were zero-size (`0 x 0`) and never entered the viewport.

Screenshots:

- Desktop failure: `.collab/tasks/screenshots/2026-05-11-production-current/demo-reader/production-demo-reader-desktop-failure.png`
- Mobile failure: `.collab/tasks/screenshots/2026-05-11-production-current/demo-reader/production-demo-reader-mobile-failure.png`

## Interpretation

Current production is still not a clean pass for public demo direct citation links. A previous production run showed desktop pass and mobile fail; this rerun shows both viewports failing the visibility condition. The local patched frontend already passed desktop and mobile against the production backend with mocked session init in `.collab/tasks/qa-local-demo-reader-ux-after-mobile-citation-fix-2026-05-11.json`, so the remaining closure step is frontend deploy plus a production rerun without `--mock-session`.

Tracking bug: `.collab/tasks/bug-2026-05-11-production-demo-mobile-citation-highlight-not-visible.md`
