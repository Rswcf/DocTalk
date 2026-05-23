# Browser Sharing UX Run - 2026-05-10

Scope: authenticated creation of a public shared-session fixture, then anonymous browser verification of `/shared/[token]` on desktop and mobile. This run focuses on public rendering, answer anchors, invalid/revoked share behavior, privacy field stripping, layout overflow, and console errors.

## Environment

- Backend: host FastAPI at `http://127.0.0.1:8000`.
- Frontend: Next.js dev server at `http://localhost:3000`.
- Worker: existing local Celery workers for `default,parse`.
- Infra: local Docker Compose Postgres, Redis, Qdrant, and MinIO.
- Browser driver: Playwright Chromium.
- Viewports: desktop `1440x900`, mobile `390x844`.

## Test Data

- Fixture script: `.collab/scripts/qa_browser_sharing_fixture.py`.
- Browser script: `.collab/scripts/qa_browser_sharing_ux.js`.
- Fixture output: `.collab/tasks/qa-browser-sharing-fixture-2026-05-10.json`.
- Raw browser evidence: `.collab/tasks/qa-browser-sharing-ux-2026-05-10.json`.
- Cleanup output: `.collab/tasks/qa-browser-sharing-fixture-cleanup-2026-05-10.json`.
- User: synthetic Plus QA user.
- Document: `test_inputs/semiconductor.pdf`.
- Session: synthetic user/assistant messages with a citation payload that intentionally included private fields before sharing: `chunk_id`, `document_id`, `bboxes`, and `confidence_score`.

The fixture cleanup verified `users=0`, `documents=0`, `sessions=0`, and `shared_sessions=0`.

## Commands

```bash
cd backend && python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
cd frontend && npm run dev -- --hostname 0.0.0.0 --port 3000

python3 .collab/scripts/qa_browser_sharing_fixture.py create \
  --api-base http://127.0.0.1:8000 \
  --json-out .collab/tasks/qa-browser-sharing-fixture-2026-05-10.json

node .collab/scripts/qa_browser_sharing_ux.js \
  --fixture .collab/tasks/qa-browser-sharing-fixture-2026-05-10.json \
  --base-url http://localhost:3000 \
  --api-base http://127.0.0.1:8000 \
  --json-out .collab/tasks/qa-browser-sharing-ux-2026-05-10.json

python3 .collab/scripts/qa_browser_sharing_fixture.py cleanup \
  --user-id a34a4a04-6c14-43c6-914d-1268dec448bc \
  --json-out .collab/tasks/qa-browser-sharing-fixture-cleanup-2026-05-10.json
```

## Result

Final result: **pass**.

| Check | Result |
|---|---|
| Public shared API | Pass: `/api/shared/{token}` returned 200, 2 messages, expected session title and document name |
| API privacy scan | Pass: no `chunk_id`, `document_id`, `bboxes`, `confidence_score`, raw document id, or raw chunk id |
| Desktop public page | Pass: `/shared/{token}#answer-anchor` returned 200, H1 visible, answer/citation text visible |
| Desktop answer anchor | Pass: URL hash matched the assistant anchor and `:target` resolved to that answer |
| Desktop HTML privacy scan | Pass: no private citation field names or raw ids in rendered HTML/body text |
| Desktop invalid token | Pass: random UUID share token returned 404 |
| Desktop layout | Pass: no horizontal overflow, no clipped interactive controls |
| Desktop console errors | Pass: 0 on valid shared page |
| Mobile public page | Pass: shared page returned 200 with answer anchor and H1 visible |
| Mobile HTML privacy scan | Pass: no private citation field names or raw ids |
| Mobile layout | Pass: no horizontal overflow, no clipped interactive controls |
| Mobile console errors | Pass: 0 |
| Revoke share | Pass: authenticated revoke returned 204 |
| Public after revoke | Pass: same share token returned 404 |
| Cleanup | Pass: synthetic user, document, sessions, and shared session rows removed |

Screenshots:

- `.collab/tasks/screenshots/2026-05-10/sharing-desktop-anchor.png`
- `.collab/tasks/screenshots/2026-05-10/sharing-mobile-anchor.png`

## Findings

- No product bug was found in this slice.
- The first script version counted the intentionally tested invalid-token 404 as a valid-page console error. The script now snapshots valid-page console errors before the expected invalid-token navigation.

## Remaining Gaps

- This run does not cover sharing from a live ChatPanel click path or clipboard behavior; it creates the share through the backend fixture and verifies the public route.
- It does not cover share rate limiting beyond the API matrix coverage.
- It does not cover localized shared pages because `/shared/[token]` currently renders fixed English copy.
