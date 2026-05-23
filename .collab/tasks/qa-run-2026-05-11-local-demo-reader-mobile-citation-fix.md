# Local Demo Reader Mobile Citation Fix - 2026-05-11

Scope: local frontend regression for the production mobile demo reader citation failure. The frontend was run locally against the production backend for document/detail/file/chunk/PDF APIs, while the reader session create/list calls were mocked to avoid consuming production anonymous demo session rate limit.

## Code Change

Changed `frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx` so that:

- Direct `?page=N` and `?highlight=chunkId` links reveal the mobile `Document` pane instead of staying on `Chat`.
- When the mobile `Document` pane becomes visible and a citation highlight is already present, the reader triggers one additional scroll nonce after layout paint.
- Normal in-chat citation clicks reuse the same mobile reveal helper.

## Environment

- Local frontend: `http://127.0.0.1:3000`
- Backend APIs: `https://backend-production-a62e.up.railway.app`
- Harness: `.collab/scripts/qa_production_demo_reader_ux.js`
- Harness mode: `--mock-session true`
- Selected demo document: `alphabet-earnings` / `Alphabet Q4 2025 Earnings Release.pdf`
- Citation target: page `10`, chunk `f0575969-3cc0-44da-a60c-0e8d91e7659f`

## Commands

```bash
cd frontend
NEXT_PUBLIC_API_BASE=https://backend-production-a62e.up.railway.app \
  npm run dev -- --hostname 127.0.0.1 --port 3000
```

```bash
node .collab/scripts/qa_production_demo_reader_ux.js \
  --base-url http://127.0.0.1:3000 \
  --backend https://backend-production-a62e.up.railway.app \
  --mock-session true \
  --json-out .collab/tasks/qa-local-demo-reader-ux-after-mobile-citation-fix-2026-05-11.json \
  --screenshot-dir .collab/tasks/screenshots/2026-05-11/local-demo-reader-after-mobile-citation-fix
```

## Result

Final result: **pass**.

```json
{
  "desktop_result": "pass",
  "mobile_result": "pass",
  "selected_slug": "alphabet-earnings",
  "target_page": 10,
  "target_chunk_id": "f0575969-3cc0-44da-a60c-0e8d91e7659f",
  "desktop_canvas_count": 8,
  "mobile_canvas_count": 7,
  "desktop_overlay_count": 66,
  "mobile_overlay_count": 66,
  "desktop_console_errors": 0,
  "mobile_console_errors": 0,
  "desktop_chat_requests": 0,
  "mobile_chat_requests": 0,
  "deleted_sessions": ["mocked", "mocked"]
}
```

Evidence: `.collab/tasks/qa-local-demo-reader-ux-after-mobile-citation-fix-2026-05-11.json`

Screenshots:

- Desktop: `.collab/tasks/screenshots/2026-05-11/local-demo-reader-after-mobile-citation-fix/production-demo-reader-desktop.png`
- Mobile: `.collab/tasks/screenshots/2026-05-11/local-demo-reader-after-mobile-citation-fix/production-demo-reader-mobile.png`

## Mobile Assertions

Mobile passed:

- Reader URL loaded.
- Final URL was `/d/{document_id}` with `page` and `highlight`.
- Document title/body identified the Alphabet demo document.
- Mobile `Document` tab was selected.
- PDF canvas rendered.
- Target page `10` had a canvas.
- Target citation overlay was visible in the viewport.
- No horizontal overflow.
- No clipped interactive controls.
- No console errors.
- No failed relevant requests.
- No `/chat` requests were sent.

## Production Status

This proves the local code path, not the deployed production site. Production still needs deploy and rerun of `.collab/scripts/qa_production_demo_reader_ux.js` without `--mock-session`.
