# Frontend UI Full Coverage Audit - 2026-05-15

## Scope

- 55 frontend `page.tsx` files inventoried.
- 87 frontend component files inventoried.
- 64 non-API UI routes expanded and browser-tested, including dynamic blog, demo, reader, collection placeholder, and shared placeholder routes.
- 219 Playwright checks across desktop/mobile, light/dark/system theme modes, and 11-locale critical route smoke tests.

## Fixes Applied

- Corrected light/dark/system behavior so explicit light stays light, explicit dark stays dark, and system follows the browser color scheme.
- Moved language and theme dropdown menus into `document.body` portals so they render above cookie banners, reader chrome, and document panes.
- Removed native tooltip/title behavior from language/theme workbench controls.
- Kept demo session rate limits as readable chat-panel UI instead of turning the whole reader into a page-level failure.
- Added localized copy for demo/session 429 errors, pricing dynamic copy, visible `tOr` fallback strings, and legacy missing `en.json` parity keys across all 11 locales.
- Fixed mobile blog overflow for wide Markdown tables and long inline code/URLs.
- Added Google Tag Manager to CSP `img-src` so GTM image pings are not blocked.

## Verification

- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- Locale parity scan: all non-English locales have 0 missing keys versus `en.json`.
- `tOr(...)` fallback scan: 0 keys missing from `en.json`.
- Final browser audit: `.collab/reviews/ui-audit-artifacts/full-route-audit-final-filtered.json`
  - `checks`: 219
  - `issueCount`: 0
  - `benignConsoleCount`: 23, all local demo/session 429 or intentional missing shared-token 404 noise.
- Overlay screenshots:
  - `.collab/reviews/ui-audit-artifacts/final-reader-language-overlay-2f7b1db1-c1f7-4ab8-bed8-3fdc4c85c9fb-filtered.png`
  - `.collab/reviews/ui-audit-artifacts/final-reader-language-overlay-c235ef93-c6e9-4ab8-bed8-3fdc4c85c9fb-filtered.png`

## Manual Check List

- Open `http://localhost:3000/` and confirm light mode is actually light.
- Switch theme to Dark and confirm the whole app turns dark.
- Switch theme to System, then use OS/browser color-scheme emulation to confirm it follows system preference.
- Open a demo reader route and open the language dropdown; confirm it is not covered by the cookie banner or reader status bar.
- On `/pricing`, switch through several languages and confirm plan meter/fit text is localized.
- On a blog post with a wide comparison table, check mobile width and confirm the page itself does not horizontally scroll.
- On a demo reader route that is locally rate-limited, confirm the document still renders and only the chat panel shows a readable localized limit message.
