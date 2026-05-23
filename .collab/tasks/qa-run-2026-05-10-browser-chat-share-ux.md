# Browser Chat Share UX Run - 2026-05-10

Scope: authenticated browser validation of the live ChatPanel copy/share controls from `/d/[documentId]`. This run closes the gap left by the public shared-page test, which verified `/shared/[token]` rendering but did not click the actual chat UI share and clipboard paths.

## Environment

- Backend: host FastAPI at `http://127.0.0.1:8000`.
- Frontend: Next.js dev server at `http://localhost:3000`.
- Worker: existing local Celery workers for `default,parse`.
- Infra: local Docker Compose Postgres, Redis, Qdrant, and MinIO.
- Browser driver: Playwright Chromium.
- Viewports: desktop `1440x900`, mobile `390x844`.

## Test Data

- Fixture script: `.collab/scripts/qa_browser_chat_share_fixture.py`.
- Browser script: `.collab/scripts/qa_browser_chat_share_ux.js`.
- Fixture output: `.collab/tasks/qa-browser-chat-share-fixture-2026-05-10.json`.
- Raw browser evidence: `.collab/tasks/qa-browser-chat-share-ux-2026-05-10.json`.
- Cleanup output: `.collab/tasks/qa-browser-chat-share-fixture-cleanup-2026-05-10.json`.
- User: synthetic Plus QA user.
- Document: `test_inputs/semiconductor.pdf`.
- Session: real document session with persisted user/assistant messages. The assistant message includes a citation payload and backend-generated `share_anchor`.

The fixture cleanup verified `users=0`, `documents=0`, `sessions=0`, and `shared_sessions=0`.

## Commands

```bash
cd backend && python3 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
cd frontend && npm run dev -- --hostname 0.0.0.0 --port 3000

python3 .collab/scripts/qa_browser_chat_share_fixture.py create \
  --api-base http://127.0.0.1:8000 \
  --file test_inputs/semiconductor.pdf \
  --json-out .collab/tasks/qa-browser-chat-share-fixture-2026-05-10.json

node .collab/scripts/qa_browser_chat_share_ux.js \
  --base-url http://localhost:3000 \
  --fixture .collab/tasks/qa-browser-chat-share-fixture-2026-05-10.json \
  --json-out .collab/tasks/qa-browser-chat-share-ux-2026-05-10.json

python3 .collab/scripts/qa_browser_chat_share_fixture.py cleanup \
  --user-id 74ebca58-ee52-4bd7-8a8b-8f93d6fd9677 \
  --json-out .collab/tasks/qa-browser-chat-share-fixture-cleanup-2026-05-10.json
```

## Result

Final result after fix: **pass**.

| Check | Result |
|---|---|
| Auth/session/profile API | Pass: browser session 200 and profile proxy 200 on desktop and mobile |
| Answer copy action | Pass: the ChatPanel answer copy button wrote the answer text containing `semiconductor reading list` |
| Answer share action | Pass: `Share this answer` copied `/shared/{token}#msg-eb4a442043504e82` |
| Conversation share action | Pass: `Share conversation` copied `/shared/{token}` without an answer hash |
| Share API through frontend proxy | Pass: copied share URLs resolved to public shared data with 2 messages and the expected session title |
| Copied answer URL browser load | Pass: opening the copied answer URL rendered `/shared/[token]` and resolved `:target` to the assistant answer |
| Desktop layout | Pass: no horizontal overflow or clipped interactive controls on private reader or public shared page |
| Mobile layout | Pass: no horizontal overflow or clipped interactive controls on private reader or public shared page |
| Console errors | Pass: 0 private-page errors and 0 shared-page errors on desktop/mobile |
| Cleanup | Pass: synthetic user, document, session, and shared session rows removed |

Screenshots:

- `.collab/tasks/screenshots/2026-05-10/chat-share-desktop.png`
- `.collab/tasks/screenshots/2026-05-10/chat-share-mobile.png`
- `.collab/tasks/screenshots/2026-05-10/chat-share-public-desktop.png`
- `.collab/tasks/screenshots/2026-05-10/chat-share-public-mobile.png`

## Finding And Fix

Initial run failed on the live `Share conversation` click because the first-visit analytics consent banner intercepted pointer events over the composer action area.

- Repro: load `/d/{documentId}` as a fresh authenticated browser user with no `doctalk_analytics_consent` localStorage value, then click `Share conversation`.
- Failure: Playwright saw the share button as visible/enabled, but the fixed bottom-right consent banner subtree intercepted the pointer event.
- Fix: `frontend/src/components/CookieConsentBanner.tsx` now positions the consent banner below the header on workspace routes instead of over the bottom composer/control area.
- Retest: the same browser script passed on desktop and mobile with the banner visible.

Bug note: `.collab/tasks/bug-2026-05-10-cookie-consent-blocks-chat-share.md`.

## Remaining Gaps

- This run uses a persisted synthetic assistant answer, not a live LLM-streamed answer.
- Clipboard writes are browser-instrumented so the test is deterministic in headless Chromium; it validates the app's `navigator.clipboard.writeText` payload, not OS-level clipboard integration.
- Real OAuth login, real Stripe actions, and live LLM answer quality remain separate gaps.
