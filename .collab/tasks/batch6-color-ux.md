Implemented all 8 requested fixes with focused edits.

### What changed

1. Plus CTA accent color + Plus card gradient + “Most Popular” badge on billing page  
- Updated in `frontend/src/app/billing/page.tsx:193`, `frontend/src/app/billing/page.tsx:197`, `frontend/src/app/billing/page.tsx:232`  
- Plus upgrade button now uses:
  - `bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white`
- Plus border gradient now uses:
  - `from-indigo-500 to-violet-500`
- Plus “Most Popular” badge now uses:
  - `bg-indigo-600 dark:bg-indigo-500 text-white`
- Pro CTA and credit-pack purchase buttons remain zinc-based.

2. “Most Popular” badge in comparison table  
- Updated in `frontend/src/components/PricingTable.tsx:90`, `frontend/src/components/PricingTable.tsx:122`  
- Changed to `bg-indigo-600 dark:bg-indigo-500 text-white`.

3. Global error page restyle  
- Updated in `frontend/src/app/global-error.tsx:19`  
- Replaced inline styles with app-consistent Tailwind classes and improved button styling.

4. Focus trap in `CustomInstructionsModal`  
- Updated in `frontend/src/components/CustomInstructionsModal.tsx:19`, `frontend/src/components/CustomInstructionsModal.tsx:39`, `frontend/src/components/CustomInstructionsModal.tsx:100`  
- Added modal container ref + keydown handler for Tab/Shift+Tab cycling.
- Focus cycle is constrained to textarea + clear/cancel/save controls.
- Added explicit Cancel button per your requested flow.

5. Replaced `window.confirm` for document/session deletion  
- Document list: `frontend/src/app/page.tsx:40`, `frontend/src/app/page.tsx:178`, `frontend/src/app/page.tsx:375`  
- Session dropdown: `frontend/src/components/SessionDropdown.tsx:24`, `frontend/src/components/SessionDropdown.tsx:102`, `frontend/src/components/SessionDropdown.tsx:214`, `frontend/src/components/SessionDropdown.tsx:264`  
- Added `confirmDeleteId` state and inline `Delete? Yes / No` confirmation UI.

6. ModeSelector radiogroup semantics  
- Updated in `frontend/src/components/ModeSelector.tsx:68`, `frontend/src/components/ModeSelector.tsx:78`  
- Added:
  - container `role="radiogroup"` + `aria-label="Performance mode"`
  - per-button `role="radio"` + `aria-checked`.

7. Hardcoded strings moved to i18n
- `frontend/src/components/Chat/MessageBubble.tsx:141`
  - now uses `chat.copied`, `chat.copyCode`
- `frontend/src/app/d/[documentId]/page.tsx:255`, `frontend/src/app/d/[documentId]/page.tsx:263`
  - now uses `viewer.slides`, `viewer.text`
- `frontend/src/components/AuthFormContent.tsx:28`, `frontend/src/components/AuthFormContent.tsx:35`, `frontend/src/components/AuthFormContent.tsx:48`, `frontend/src/components/AuthFormContent.tsx:51`
  - now uses `auth.emailUnavailable`, `auth.unexpectedError`, `auth.resendFailed`

8. Added new locale keys across all 11 locale files  
- Added to `frontend/src/i18n/locales/en.json:406` and corresponding files:
  - `ar.json`, `de.json`, `es.json`, `fr.json`, `hi.json`, `it.json`, `ja.json`, `ko.json`, `pt.json`, `zh.json`
- Keys added:
  - `chat.copied`
  - `chat.copyCode`
  - `viewer.slides`
  - `viewer.text`
  - `auth.emailUnavailable`
  - `auth.unexpectedError`
  - `auth.resendFailed`

### Validation

Ran lint on touched files:
- `cd frontend && npm run lint -- --file ...`
- Result: no errors from these changes.
- Existing warnings remain in `frontend/src/app/d/[documentId]/page.tsx` for hook dependency arrays (pre-existing pattern).