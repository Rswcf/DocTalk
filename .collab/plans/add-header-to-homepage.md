# Plan: Add Header to Homepage

## Goal
Add the existing `<Header />` component to the homepage (`/`) so logged-in users can see their avatar, credits, and access navigation (Profile/Billing/Sign Out).

## File to Edit
`frontend/src/app/page.tsx` — this is the **only** file that needs changes.

## Exact Changes

### Change 1: Add import
Add this import after the existing imports (after line 12):

```typescript
import Header from '../components/Header';
```

### Change 2: Restructure the return JSX
Replace the current return block (lines 119–248):

**Current:**
```tsx
return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-10 dark:bg-gray-900">
      {!isLoggedIn ? (
        ...
      ) : (
        <>
          ...
        </>
      )}
    </main>
  );
```

**New:**
```tsx
return (
    <div className="flex flex-col min-h-screen dark:bg-gray-900">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center p-8 gap-10">
        {!isLoggedIn ? (
          ... (keep logged-out section exactly as-is)
        ) : (
          <>
            ... (keep logged-in section, but remove the <h1> title — see Change 3)
          </>
        )}
      </main>
    </div>
  );
```

Specifically:
1. Wrap everything in `<div className="flex flex-col min-h-screen dark:bg-gray-900">`
2. Add `<Header />` as the first child of that div
3. Change `<main>` className from `"min-h-screen flex flex-col items-center justify-center p-8 gap-10 dark:bg-gray-900"` to `"flex-1 flex flex-col items-center justify-center p-8 gap-10"` (remove `min-h-screen` and `dark:bg-gray-900` since the parent div now has them)

### Change 3: Remove duplicate title in logged-in section
In the logged-in branch (`isLoggedIn` is true), remove the `<h1>` element on line 169:

```tsx
<h1 className="text-3xl font-semibold text-center dark:text-gray-100">{t('app.title')}</h1>
```

This is redundant because the Header already shows "DocTalk" as a brand link. The logged-out section's `<h1>` (line 123) should be **kept** as a hero title.

## Summary of All Edits (in order)

1. **Line 12** — Add `import Header from '../components/Header';` after the PrivacyBadge import
2. **Line 120** — Replace `<main className="min-h-screen flex flex-col items-center justify-center p-8 gap-10 dark:bg-gray-900">` with:
   ```tsx
   <div className="flex flex-col min-h-screen dark:bg-gray-900">
     <Header />
     <main className="flex-1 flex flex-col items-center justify-center p-8 gap-10">
   ```
3. **Line 169** — Delete `<h1 className="text-3xl font-semibold text-center dark:text-gray-100">{t('app.title')}</h1>`
4. **Line 247–248** — Replace `</main>` with:
   ```tsx
       </main>
     </div>
   ```

## What NOT to Change
- Do NOT touch `Header.tsx` or any other component
- Do NOT add new i18n keys
- Do NOT change the logged-out section's `<h1>` hero title
- Do NOT change any logic, state, or callbacks
- Keep all existing className styles on inner elements unchanged

## Verification
After the change, `npm run build` in `frontend/` should succeed with no type errors.
