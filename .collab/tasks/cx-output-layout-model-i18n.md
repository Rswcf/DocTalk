I’m going to summarize each step I implemented, the files changed, and any issues resolved during verification.

**Step 1: Create i18n infrastructure**
- Added context, types, LOCALES, and hook:
  - `frontend/src/i18n/index.ts:1`
- Added LocaleProvider with SSR‑safe detection, t() helper with interpolation, and html lang/dir effects:
  - `frontend/src/i18n/LocaleProvider.tsx:1`
- Added 8 locale JSON files with all keys and accurate translations:
  - `frontend/src/i18n/locales/en.json:1`
  - `frontend/src/i18n/locales/zh.json:1`
  - `frontend/src/i18n/locales/hi.json:1`
  - `frontend/src/i18n/locales/es.json:1`
  - `frontend/src/i18n/locales/ar.json:1`
  - `frontend/src/i18n/locales/fr.json:1`
  - `frontend/src/i18n/locales/bn.json:1`
  - `frontend/src/i18n/locales/pt.json:1`
- Notes:
  - SSR‑safe localStorage used (typeof window !== 'undefined' ? localStorage.getItem(...) : null) || default.
  - ErrorBoundary is unchanged as requested.

**Step 2: Create model definitions**
- Added interface and model list:
  - `frontend/src/lib/models.ts:1`
  - Includes `DEFAULT_MODEL_ID` and `AVAILABLE_MODELS` exactly per plan.

**Step 3: Update Zustand store**
- Added model state and setter with SSR‑safe localStorage hydration; persisted on change:
  - `frontend/src/store/index.ts:1`
  - New fields: `selectedModel`, `setSelectedModel`.
  - Initial value reads `localStorage` with SSR‑safe pattern.
  - `reset()` does not reset `selectedModel` (preserves current value).

**Step 4: Create UI components**
- Model selector:
  - `frontend/src/components/ModelSelector.tsx:1`
  - Grouped by provider, shows current model, checkmark for selected, outside‑click close, disabled while streaming.
- Language selector:
  - `frontend/src/components/LanguageSelector.tsx:1`
  - Globe icon + current locale (e.g., EN), dropdown with flags and native names, checkmark for selected, outside‑click close.

**Step 5: Update layout.tsx**
- Wrapped LocaleProvider inside ThemeProvider and outside ErrorBoundary:
  - `frontend/src/app/layout.tsx:1`
  - Keep static `<html lang="en">` as default; client effect updates actual lang/dir.

**Step 6: Update Header.tsx**
- Added ModelSelector and LanguageSelector; localized theme toggle tooltip and app title:
  - `frontend/src/components/Header.tsx:1`
  - Layout order: DocTalk / filename … [ModelSelector] [ThemeToggle] [LanguageSelector]

**Step 7: Layout swap (document reader page)**
- Replaced flex layout with react‑resizable‑panels (v4 API: Group/Panel/Separator):
  - `frontend/src/app/d/[documentId]/page.tsx:1`
  - Chat on left: `<Panel defaultSize={35} minSize={25}>` with `min-w-[320px]`.
  - Resize handle: `<Separator>` with `w-1.5` and grip indicator, aria-label set.
  - PDF on right: `<Panel defaultSize={65} minSize={35}>`.
  - PanelGroup → Group with `orientation="horizontal"` and `className="flex-1 min-h-0"`.
  - Localized placeholders via `t('doc.loading')` and `t('doc.initChat')`.
  - Note: Library v4 uses `Group` and `Separator` (not `PanelGroup`/`PanelResizeHandle`), updated accordingly.

**Step 8: Update ChatPanel.tsx**
- Border left → right; localized strings; passed selected model to stream:
  - `frontend/src/components/Chat/ChatPanel.tsx:1`
  - Container class `border-r`.
  - Reads `selectedModel` from store; passes it to `chatStream`.
  - Replaced SUGGESTED_QUESTIONS with t() keys and localized placeholder/send text and error strings.

**Step 9: Update sse.ts**
- Added optional model parameter and included in request body when provided:
  - `frontend/src/lib/sse.ts:1`
  - `chatStream(..., model?: string)`, body merges `{ model }` if present.

**Step 10: Localize remaining components**
- Homepage (all strings):
  - `frontend/src/app/page.tsx:1`
- MessageBubble (copy/feedback tooltips, citation jump tooltip with interpolation):
  - `frontend/src/components/Chat/MessageBubble.tsx:1`
- PdfToolbar (zoom/nav tooltips):
  - `frontend/src/components/PdfViewer/PdfToolbar.tsx:1`
- PdfViewer (loading/error texts):
  - `frontend/src/components/PdfViewer/PdfViewer.tsx:1`

**Step 11: Backend changes**
- ChatRequest accepts optional `model`:
  - `backend/app/schemas/chat.py:1`
- Settings has `ALLOWED_MODELS` list:
  - `backend/app/core/config.py:1`
- Pass `body.model` to chat stream:
  - `backend/app/api/chat.py:1`
- Chat service validates `model` and uses `effective_model` for OpenRouter call:
  - `backend/app/services/chat_service.py:1`
  - Signature updated: `model: Optional[str] = None`
  - Fallback to `settings.LLM_MODEL` when not provided or not allowed.

**Step 12: Verify**
- Frontend build:
  - Ran `cd frontend && npm run build`: initially failed due to API mismatch with `react-resizable-panels` v4 (no `PanelGroup`/`PanelResizeHandle`). Fixed by switching to `Group`/`Separator` and `orientation="horizontal"`. After fix, build succeeded.
- Frontend lint:
  - Ran `cd frontend && npx next lint`: fixed a React Hooks dependency warning by adding `t` to effect deps in `frontend/src/app/d/[documentId]/page.tsx`. Lint now passes with no warnings or errors.

Notes and assumptions:
- Kept ErrorBoundary as-is (class component with hardcoded strings), per instruction.
- Used the SSR‑safe localStorage pattern in the store and i18n.
- The `react-resizable-panels` API adjustment was required due to installed version (4.6.0).

Would you like me to run the dev servers for a quick manual check, or commit these changes?