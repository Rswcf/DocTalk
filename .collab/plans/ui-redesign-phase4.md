# UI Redesign Phase 4: Polish + Dark Mode + Responsive

## Task
Audit and fix all pages modified in Phase 1-3 for dark mode consistency, responsive breakpoints, and subtle hover transitions. Also check for any remaining `gray-*` or `blue-*` color classes that should be `zinc-*`.

## Scope
Files to audit and fix:
1. `frontend/src/app/page.tsx` — Homepage (logged-out landing + logged-in dashboard)
2. `frontend/src/components/Header.tsx` — Header with variant prop
3. `frontend/src/components/landing/HeroSection.tsx` — Hero section
4. `frontend/src/components/landing/FeatureGrid.tsx` — Feature grid
5. `frontend/src/app/demo/page.tsx` — Demo page
6. `frontend/src/app/billing/page.tsx` — Billing page
7. `frontend/src/app/auth/page.tsx` — Auth page
8. `frontend/src/components/AuthModal.tsx` — Auth modal
9. `frontend/src/components/PrivacyBadge.tsx` — Privacy badge (may still use old colors)
10. `frontend/src/components/UserMenu.tsx` — User menu dropdown
11. `frontend/src/components/CreditsDisplay.tsx` — Credits display
12. `frontend/src/components/ModelSelector.tsx` — Model selector
13. `frontend/src/components/LanguageSelector.tsx` — Language selector
14. `frontend/src/components/SessionDropdown.tsx` — Session dropdown
15. `frontend/src/components/PaywallModal.tsx` — Paywall modal

## Checks to Perform

### 1. Color Audit
Search ALL files in `frontend/src/` for remaining `gray-` and `blue-` Tailwind classes. Replace with zinc equivalents:
- `gray-50` → `zinc-50`
- `gray-100` → `zinc-100`
- `gray-200` → `zinc-200`
- `gray-300` → `zinc-300`
- `gray-400` → `zinc-400`
- `gray-500` → `zinc-500`
- `gray-600` → `zinc-600`
- `gray-700` → `zinc-700`
- `gray-800` → `zinc-800`
- `gray-900` → `zinc-900`
- `blue-*` → `zinc-*` (for primary actions, not for external brand colors like Google blue)
- Exception: Keep `blue-*` ONLY in the Google OAuth SVG paths (those are brand colors like `#4285F4`)
- Exception: Keep `yellow-*` for warning/processing badges
- Exception: Keep `red-*` for error states
- Exception: Keep `green-*` only if used for success states

### 2. Dark Mode Verification
For each component, verify:
- Page background: `bg-white dark:bg-zinc-950` (NOT `dark:bg-gray-900`)
- Text: primary `text-zinc-900 dark:text-zinc-50`, secondary `text-zinc-500 dark:text-zinc-400`
- Borders: `border-zinc-200 dark:border-zinc-800`
- Cards: proper bg contrast in dark mode
- Buttons: primary `bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900` (inverted in dark mode)
- Inputs/selects: proper dark mode background and border

### 3. Responsive Check
Ensure mobile (375px) viewport works:
- Hero section: `text-5xl md:text-6xl lg:text-7xl` (scales down on mobile)
- Feature grid: `grid-cols-1 md:grid-cols-3` (stacks on mobile)
- Demo cards: `grid-cols-1 md:grid-cols-3` (stacks on mobile)
- Billing cards: `grid md:grid-cols-3` (stacks on mobile)
- Upload zone: proper padding on mobile
- Header: no overflow on mobile

### 4. Transition Polish
Add `transition-all duration-200` to interactive elements that don't have it yet.

## Execution Steps

1. Run `rg "gray-|blue-" frontend/src/ --type tsx --type ts -l` to find all files with old colors
2. For each file found, read it, replace gray→zinc and blue→zinc (respecting exceptions above), write it back
3. Specifically check and fix these known components that weren't touched in Phase 1-3:
   - PrivacyBadge.tsx
   - UserMenu.tsx
   - CreditsDisplay.tsx
   - ModelSelector.tsx
   - LanguageSelector.tsx
   - SessionDropdown.tsx
   - PaywallModal.tsx
4. Run `npm run lint` in frontend/ to verify no issues
5. Report all files changed

## IMPORTANT NOTES
- Do NOT modify files outside `frontend/src/`
- Do NOT change functional logic — only CSS classes/colors
- Keep brand colors (Google OAuth SVG fill attributes like `#4285F4`, `#34A853`, etc.) unchanged
- Keep `red-*` for error states, `yellow-*` for warnings, `green-*` for success
- The `highlight-base` and `highlight-strong` CSS variables use sky-blue and should NOT be changed (they're for PDF citation highlights)
- Do NOT modify `globals.css` (already updated)
- Do NOT modify locale JSON files
