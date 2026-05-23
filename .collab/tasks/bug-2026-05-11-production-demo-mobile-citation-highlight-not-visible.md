# BUG-2026-05-11-PRODUCTION-DEMO-CITATION-HIGHLIGHT-NOT-VISIBLE

Status: **fixed locally, current production still failing desktop/mobile, production deploy/retest pending**.

## Summary

Production demo reader can render the target PDF page and citation overlay nodes from a direct citation URL, but the cited highlight does not reliably become visible in the viewport. The first production run showed desktop pass and mobile fail; the current production rerun shows both desktop and mobile fail.

## Environment

- Frontend: `https://www.doctalk.site`
- Backend: `https://backend-production-a62e.up.railway.app`
- Viewports: `1440 x 900` desktop and `390 x 844` mobile emulation
- Demo document: `alphabet-earnings`
- Document id: `d949b371-8934-49e2-80d7-96d033bf1217`
- Target page: `10`
- Target chunk: `f0575969-3cc0-44da-a60c-0e8d91e7659f`

## Reproduction

1. Open:

   ```text
   https://www.doctalk.site/d/d949b371-8934-49e2-80d7-96d033bf1217?page=10&highlight=f0575969-3cc0-44da-a60c-0e8d91e7659f
   ```

2. Test desktop `1440 x 900` and mobile viewport around `390 x 844`.
3. On mobile, open the `Document` tab.
4. Wait for PDF rendering and citation highlight.

Expected:

- The reader lands on page `10`.
- The cited bbox highlight is visible in the viewport.
- The user can immediately see what the citation refers to.

Current production actual:

- The reader lands on page `10` and renders the PDF.
- The page input shows `10`.
- The target page has canvas content.
- The citation overlay count is non-zero, but no target overlay enters the viewport before timeout.
- Desktop has overlay rects below the visible viewport.
- Mobile has zero-size overlay rects in the current production rerun.
- Screenshots show page `10` without a visible yellow highlight; the cookie consent banner also occupies the lower viewport.

## Evidence

- Run record: `.collab/tasks/qa-run-2026-05-11-production-demo-reader-ux.md`
- JSON: `.collab/tasks/qa-production-demo-reader-ux-2026-05-11.json`
- Mobile screenshot: `.collab/tasks/screenshots/2026-05-11/production-demo-reader/production-demo-reader-mobile-failure.png`
- Current production rerun: `.collab/tasks/qa-run-2026-05-11-production-current-demo-reader-ux.md`
- Current production JSON: `.collab/tasks/qa-production-current-demo-reader-ux-2026-05-11.json`
- Current production desktop screenshot: `.collab/tasks/screenshots/2026-05-11-production-current/demo-reader/production-demo-reader-desktop-failure.png`
- Current production mobile screenshot: `.collab/tasks/screenshots/2026-05-11-production-current/demo-reader/production-demo-reader-mobile-failure.png`

Relevant JSON facts:

```json
{
  "failed_stage": "wait_target_overlay",
  "response_status": 200,
  "targetPageMountedWithCanvas": true,
  "targetOverlayCount": 66,
  "targetOverlayInViewport": false,
  "pageInputs": [{"label": "Page", "value": "10"}],
  "console_errors": [],
  "chat_requests": [],
  "cleanup": [{"status": 204}]
}
```

Current production rerun summary:

```json
{
  "desktop_result": "fail",
  "mobile_result": "fail",
  "desktop_overlay_count": 66,
  "mobile_overlay_count": 66,
  "desktop_chat_requests": 0,
  "mobile_chat_requests": 0,
  "deleted_sessions": [204, 204]
}
```

## Impact

- Users opening shared/direct citation links may reach the right page but not the exact cited passage.
- This weakens the main trust promise: citation-backed answers with source inspection.
- The failure is visible on a public production demo path, so it affects first-time evaluators.

## Notes / Suspected Causes

- Desktop passed in the first production run, but failed in the current production rerun with the same document, page, and chunk. Treat the production state as unresolved until a post-deploy rerun passes both viewports.
- Production still appears to have deploy drift in other areas, including the known public CSP `media-src 'none'` issue.
- Possible causes to inspect: hidden duplicate reader layout, mobile tab mount timing, citation scroll running while the document pane is hidden, or cookie consent overlay reducing the effective visible area.
- Local code already contains a responsive single-layout fix for the reader; production may need deploy/retest to confirm whether this issue is already fixed locally.

## Local Fix - 2026-05-11

Patched `frontend/src/app/d/[documentId]/DocumentReaderPageClient.tsx`:

- Direct `?page=N` and `?highlight=chunkId` links now reveal the mobile `Document` pane.
- When the mobile `Document` pane becomes visible with an existing highlight, the reader triggers one extra scroll nonce after layout paint.
- In-chat citation clicks use the same reveal helper.

Local verification used the production backend and storage for document/chunk/PDF data, with session create/list mocked to avoid consuming production anonymous demo session rate limit:

- Run: `.collab/tasks/qa-run-2026-05-11-local-demo-reader-mobile-citation-fix.md`
- JSON: `.collab/tasks/qa-local-demo-reader-ux-after-mobile-citation-fix-2026-05-11.json`
- Result: `desktop=pass`, `mobile=pass`
- Mobile facts: `targetOverlayInViewport=true`, `mobile_overlay_count=66`, `mobile_console_errors=0`, `mobile_chat_requests=0`

Production remains open until the frontend is deployed and the production harness passes without `--mock-session`.
