# Production Demo Reader UX - 2026-05-11

Scope: production browser UI/UX check for a public demo document reader and direct citation-highlight URL, without sending an LLM chat message.

## Environment

- Frontend: `https://www.doctalk.site`
- Backend: `https://backend-production-a62e.up.railway.app`
- Harness: `.collab/scripts/qa_production_demo_reader_ux.js`
- Selected demo document: `alphabet-earnings` / `Alphabet Q4 2025 Earnings Release.pdf`
- Citation target: page `10`, chunk `f0575969-3cc0-44da-a60c-0e8d91e7659f`

## Command

```bash
node .collab/scripts/qa_production_demo_reader_ux.js \
  --json-out .collab/tasks/qa-production-demo-reader-ux-2026-05-11.json
```

## Result

Final result: **fail**.

```json
{
  "desktop_result": "pass",
  "mobile_result": "fail",
  "selected_slug": "alphabet-earnings",
  "target_page": 10,
  "target_chunk_id": "f0575969-3cc0-44da-a60c-0e8d91e7659f",
  "desktop_console_errors": 0,
  "mobile_console_errors": 0,
  "desktop_chat_requests": 0,
  "mobile_chat_requests": 0
}
```

Evidence: `.collab/tasks/qa-production-demo-reader-ux-2026-05-11.json`

Screenshots:

- Desktop pass: `.collab/tasks/screenshots/2026-05-11/production-demo-reader/production-demo-reader-desktop.png`
- Mobile failure: `.collab/tasks/screenshots/2026-05-11/production-demo-reader/production-demo-reader-mobile-failure.png`

## Desktop Coverage

Desktop passed:

- Reader URL loaded with `200`.
- Document title/body contained the Alphabet demo document.
- Chat and document panes rendered.
- PDF canvas rendered.
- Target page `10` had a canvas.
- Citation overlay for the target chunk was visible in the viewport.
- No horizontal overflow.
- No clipped interactive controls.
- No console errors.
- No `/chat` requests were sent.
- Created anonymous demo session was captured and deleted with `204`.

## Mobile Failure

Mobile loaded most of the reader successfully:

- Reader URL loaded with `200`.
- Document tab opened.
- PDF canvas rendered.
- Page input showed page `10`.
- Target page `10` had a canvas.
- No horizontal overflow.
- No clipped interactive controls.
- No console errors.
- No `/chat` requests were sent.
- Created anonymous demo session was captured and deleted with `204`.

But the run timed out waiting for the target citation overlay to become visible in the mobile viewport.

Observed mobile state:

- `failed_stage`: `wait_target_overlay`
- `targetOverlayCount`: `66`
- `targetOverlayInViewport`: `false`
- `targetRect`: `0 x 0` for the first matching page node inspected by the harness
- Screenshot shows the mobile reader on page `10`, but no visible yellow citation highlight; the cookie consent banner is also present at the bottom of the viewport.

## Harness Note

The first attempted run failed due a loose Playwright selector for the mobile `Document` tab matching suggested-question and CTA buttons that contain the word "document". That harness issue was fixed by using an exact `Document` button selector, and the created session from the failed attempt was deleted with `204`. The final result above is from the corrected rerun.

## Tracking Bug

Tracked as: `.collab/tasks/bug-2026-05-11-production-demo-mobile-citation-highlight-not-visible.md`
