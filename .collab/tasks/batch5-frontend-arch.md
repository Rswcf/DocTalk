Implemented all 6 requested fixes with focused edits.

### What changed

1. Extracted shared dropdown keyboard hook
- Added `frontend/src/lib/useDropdownKeyboard.ts:1`.
- Refactored these components to use it:
  - `frontend/src/components/UserMenu.tsx:7`
  - `frontend/src/components/ThemeSelector.tsx:7`
  - `frontend/src/components/LanguageSelector.tsx:8`
  - `frontend/src/components/SessionDropdown.tsx:9`

2. Removed silent error swallowing
- `frontend/src/app/d/[documentId]/page.tsx`
  - Profile load catch now logs: `frontend/src/app/d/[documentId]/page.tsx:107`
  - Converted PDF URL catch now logs: `frontend/src/app/d/[documentId]/page.tsx:146`
  - Session creation catch now logs + sets error state: `frontend/src/app/d/[documentId]/page.tsx:233`
- `frontend/src/components/CreditsDisplay.tsx`
  - Credits/profile catch now logs: `frontend/src/components/CreditsDisplay.tsx:47`

3. Added tsconfig path alias
- Added `paths` mapping in `frontend/tsconfig.json:20`.

4. Updated TS target
- Changed target to `ES2020` in `frontend/tsconfig.json:3`.

5. Added dynamic page title hook + usage
- Added `frontend/src/lib/usePageTitle.ts:1`.
- Added calls in requested pages:
  - `frontend/src/app/billing/page.tsx:23`
  - `frontend/src/app/profile/page.tsx:18`
  - `frontend/src/app/demo/page.tsx:33`
  - `frontend/src/app/d/[documentId]/page.tsx:74` (using `documentName`)
  - `frontend/src/app/privacy/page.tsx:8`
  - `frontend/src/app/terms/page.tsx:8`
  - `frontend/src/app/collections/page.tsx:16`
  - `frontend/src/app/admin/page.tsx:137`

6. Added 404 page
- Created `frontend/src/app/not-found.tsx:1` with the requested UI.

### Validation run
- `next lint` on all touched files: passed.
- Existing warnings remain in `frontend/src/app/d/[documentId]/page.tsx` for hook dependency arrays (`react-hooks/exhaustive-deps`).
- `tsc --noEmit` reports an unrelated existing error: `frontend/src/components/CustomInstructionsModal.tsx:48` (`modal` possibly `null`).