Batch B is implemented in the required order: `FE-06 → FE-05 → FE-07 → FE-13 → FE-18`, frontend-only.

Key outcomes:
- `FE-06`: Removed Win98 theme branches/components/CSS and option; added migration in `frontend/src/app/ThemeProvider.tsx` to convert stored `theme=win98` to `dark`; deleted `frontend/src/components/win98/*`.
- `FE-05`: Extracted hooks and wired page:
  - `frontend/src/lib/useDocumentLoader.ts`
  - `frontend/src/lib/useChatSession.ts`
  - `frontend/src/lib/useUserPlanProfile.ts`
  - updated `frontend/src/app/d/[documentId]/page.tsx`
- `FE-07`: Fully typed `frontend/src/lib/authAdapter.ts` with backend payload interfaces + converter functions; removed unsafe casts.
- `FE-13`: Removed `any` in priority files:
  - `frontend/src/components/PdfViewer/PdfViewer.tsx`
  - `frontend/src/store/index.ts`
  - `frontend/src/lib/sse.ts`
  - `frontend/src/components/Chat/ChatPanel.tsx`
- `FE-18`: Split ChatPanel concerns into:
  - `frontend/src/lib/useChatStream.ts`
  - `frontend/src/components/Chat/PlusMenu.tsx`
  - `frontend/src/components/Chat/MessageErrorBoundary.tsx`
  - `frontend/src/lib/citations.ts`
  - `frontend/src/lib/constants.ts`
  - updated `frontend/src/components/Chat/ChatPanel.tsx`

Validation:
- `cd frontend && npx next lint` passed (no errors; pre-existing warnings remain in unrelated files).
- `cd frontend && npx tsc --noEmit` passed.

Change summary was written to:
- `.collab/archive/cx-output-3.4.md`