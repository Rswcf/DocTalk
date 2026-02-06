# UI Redesign Finalize: Showcase placeholder + Commit + Push

## Task
1. Fix the showcase image section in the homepage to handle missing `/showcase.png` gracefully
2. Commit all changes with a descriptive commit message
3. Push to GitHub

## Step 1: Fix showcase section

The homepage (`frontend/src/app/page.tsx`) references `<Image src="/showcase.png" ... />` but the file doesn't exist yet. Instead of using `next/image` (which requires the file to exist at build time), replace the `<Image>` with a styled placeholder div that looks like a product mockup. This avoids build errors.

Edit `frontend/src/app/page.tsx`:
- Remove the `import Image from 'next/image';` line (it's no longer used)
- Replace the `<Image src="/showcase.png" ... />` block with a styled placeholder:

```tsx
<div className="aspect-video bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex items-center justify-center">
  <div className="text-center">
    <div className="text-4xl mb-2">📄💬</div>
    <p className="text-zinc-400 dark:text-zinc-500 text-sm">PDF + AI Chat Split View</p>
  </div>
</div>
```

## Step 2: Run lint to verify

Run `npm run lint` in `frontend/` to ensure everything passes.

## Step 3: Commit all changes

Run these git commands from the project root `/Users/mayijie/Projects/Code/010_DocTalk`:

```bash
git add -A
git commit -m "feat: premium SaaS UI redesign with monochrome zinc palette

- Add Inter font via next/font/google with Tailwind fontFamily config
- Update CSS variables to zinc-based palette (zinc-950 dark bg, zinc-200 borders)
- Add Header variant prop (minimal/full) for context-appropriate chrome
- Create HeroSection and FeatureGrid landing page components
- Redesign homepage: large hero typography, product showcase, feature grid (logged-out)
- Redesign dashboard: wider layout, rounded-2xl upload zone, card-style doc list (logged-in)
- Restyle Demo, Billing, Auth pages and AuthModal to monochrome aesthetic
- Replace all gray-*/blue-* classes with zinc-* across 31 components
- Add dark mode inverted primary buttons (bg-zinc-900 dark:bg-zinc-50)
- Add responsive mobile fixes (header truncation, padding breakpoints, hidden credits)
- Standardize transition-all duration-200 on all interactive elements
- Add 16 new i18n landing page keys across all 8 locales

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

## Step 4: Push to GitHub

```bash
git push origin main
```

## IMPORTANT
- Do NOT use `git add .` — use `git add -A` to include all changes
- The commit message MUST end with the Co-Authored-By line
- Push to `origin main`
- Do NOT amend any existing commit
- Do NOT use --force
