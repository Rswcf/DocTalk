# Auth Page Redesign — Design Spec

**Date:** 2026-05-18
**Status:** Approved (design), pending spec review
**Topic:** Redesign the `/auth` login page to a minimal centered card, removing "AI-flavored" visual clichés, with a Google Stitch MCP variant-generation step before implementation.

## Problem

The current `/auth` page is a two-column marketing + form layout wrapped in the
`dt-stitch-theme` container. It carries seven recognizable "AI-generated page"
clichés that make it read as low-quality:

1. Triple-stacked gradient washes (diagonal violet/blue streak + 2 radial glows)
2. Dot-grid background texture (`::before` pseudo-element)
3. Glassmorphism everywhere (`backdrop-blur(22–30px)`, `bg-white/7–12`, inset highlights, oversized soft shadows)
4. A fake "command panel" product mockup ("Summarize the renewal risks…")
5. A generic three-up benefit-card row (circular icon + title + body)
6. A Sparkles-icon eyebrow pill ("✨ Account access")
7. An oversized hero headline (`text-7xl`, `leading-[0.98]`)

The goal is to converge on Google Stitch's actual aesthetic — solid surfaces,
restrained whitespace, flat hierarchy — which means **doing subtraction**.

## Decisions (locked during brainstorming)

| Topic | Decision |
|---|---|
| Layout | Minimal centered card (Google-style). The left marketing column is removed entirely. |
| Background | Faint single-color page background; borderless, soft-shadow floating card. No gradients, no texture. |
| Card content | Core only + the "free credits" conversion hook. Decorative lock icon, "Secure account access" eyebrow, and the AI-disclosure line are dropped. |
| Stitch MCP | Generate 2–3 login-page variants from the locked constraints → user picks one in the Stitch artifacts → implement faithfully in code. |
| Primary button | Neutral dark (light mode) / light (dark mode) — **not** indigo. Matches the chosen background option B. |
| Back-home affordance | The DocTalk logo inside the card links home; the separate "Back home" header link is removed. |
| Card subtitle | Reuse existing `auth.panelSubtitle`; continuation variant reuses `auth.continueSubtitle`. |
| Dark mode | Both light and dark themes retained. |

## Scope — files touched

- `frontend/src/app/auth/page.tsx` — rewritten as a minimal centered card.
- `frontend/src/components/AuthFormContent.tsx` — restyled **and decoupled** from `dt-stitch-theme` (see below).
- `frontend/src/app/globals.css` — remove `.dt-auth-page`, `.dt-auth-brand`, `.dt-auth-proof`, `.dt-auth-command-panel`, `.dt-auth-card` rules; remove auth-page reliance on `--workbench-*`.
- `frontend/src/components/AuthModal.tsx` — light follow-up so the decoupled form renders correctly inside the modal.
- `frontend/src/i18n/locales/*.json` (11 locales) — see i18n section. Expected: zero new keys.

## Architecture

### Page structure (`auth/page.tsx`)

- **Remove** the `dt-stitch-theme` wrapper. This alone deletes the gradient
  streak, the radial glows, and the dot-grid texture — they are all defined on
  `.dt-stitch-theme`.
- The page becomes a single full-viewport flex container that centers one card
  vertically and horizontally.
- Page background: solid `#fafafa` (light) / `#09090b` (dark). No texture, no gradient.
- Card: max-width ≈ 400px; solid surface (white / `zinc-900`); hairline border
  (`zinc-100` / `zinc-800`); soft elevation shadow. The card "floats" on the
  faint background (background option B).
- The `Suspense` boundary + `LoadingScreen` fallback is retained.

### Card content (top → bottom)

1. DocTalk logo + wordmark + `BETA` pill — wrapped in a `Link href="/"` (this is
   the only back-to-home affordance).
2. Heading: `t("auth.signIn")` — "Sign in".
3. Subtitle: `tOr("auth.panelSubtitle", …)`, or `tOr("auth.continueSubtitle", …)`
   when `isDocumentContinuation` is true.
4. `<AuthFormContent />` — Google button, Microsoft button, `or` divider, email
   input + submit; plus the `emailSent` success state.
5. Terms + Privacy line (`auth.termsPrefix` / `auth.termsOfService` / `auth.and` / `auth.privacyPolicy`).
6. Free-credits hook line (`auth.freeCredits`), set off by a top hairline divider.

**Removed from the card:** the decorative lock-icon box, the "Secure account
access" eyebrow label, and the AI-disclosure paragraph.

### `isDocumentContinuation` behavior

The logic (callbackUrl contains `/d/`, `/collections`, or `/document-diff`) is
kept, but now only switches the **subtitle** text. The old eyebrow and separate
hero title are gone, so `auth.continueEyebrow` / `auth.accessEyebrow` /
`auth.continueTitle` / `auth.heroTitle` are no longer referenced.

### AuthFormContent decoupling

`AuthFormContent` is shared by `/auth` (inside `dt-stitch-theme`) and
`AuthModal` (outside it). Today it uses `var(--workbench-*)`, `bg-white/N`, and
`dt-stitch-primary`, which only resolve correctly inside `.dt-stitch-theme` —
so the form currently renders incorrectly in the modal.

The redesign makes `AuthFormContent` **self-sufficient**:

- Replace `var(--workbench-ink/muted/border/...)` with standard Tailwind zinc
  tokens (`text-zinc-900 dark:text-zinc-50`, `border-zinc-200 dark:border-zinc-800`, etc.).
- Replace `bg-white/7…12` glass fills and `dt-stitch-primary` with concrete,
  context-independent classes.
- The component must look correct standalone, with no ancestor theme container.
- **No behavior change**: `getProviders` detection, magic-link submit, resend
  cooldown/limit, `emailSent` success state, error states, and all
  `trackEvent` calls are untouched.

`AuthModal` keeps its zinc-based shell; only spacing/border tweaks if needed so
the now-standalone form sits cleanly inside it.

## Visual system

- Palette: zinc monochrome + indigo accent, per `.claude/rules/frontend.md`.
  No `gray-*` / `blue-*`. Indigo is **not** used as the primary-button fill in
  this design (neutral dark/light per option B); it remains available for
  focus rings and incidental accents already in the codebase.
- No `transition-all` — specific properties only.
- OAuth buttons: solid/near-solid surface with a 1px border, pill radius,
  consistent with the existing button shapes.
- Brand SVGs (Google 4-color, Microsoft 4-square) are unchanged.

## Stitch MCP step

Before writing implementation code:

1. Feed the locked constraints (minimal centered card, faint-bg + floating
   card, core content + free-credits hook, zinc+indigo, light/dark) to the
   Stitch MCP.
2. Generate 2–3 login-page variants.
3. User selects one variant from the Stitch artifacts.
4. The selected variant guides final spacing/proportion/detail decisions; the
   page is then implemented faithfully in Next.js + Tailwind.

This is a checkpoint in the implementation plan, not a free-form redesign — the
variants must respect the decisions table above.

## i18n

- Reuse existing keys; **zero new keys expected**: `auth.signIn`,
  `auth.panelSubtitle`, `auth.continueSubtitle`, `auth.continueWithGoogle`,
  `auth.continueWithMicrosoft`, `auth.orDivider`, `auth.emailPlaceholder`,
  `auth.continueWithEmail`, `auth.checkEmail`, `auth.emailSent`,
  `auth.checkSpamHint`, `auth.resendEmail`/`Cooldown`/`MaxReached`,
  `auth.useDifferentEmail`, `auth.termsPrefix`/`termsOfService`/`and`/`privacyPolicy`,
  `auth.freeCredits`, `auth.backHome` (logo link `aria`/title — optional).
- Keys no longer referenced (`auth.heroTitle`, `auth.heroSubtitle`,
  `auth.benefit.*`, `auth.command*`, `auth.preview.*`, `auth.accessEyebrow`,
  `auth.continueEyebrow`, `auth.continueTitle`, `auth.secureAccess`,
  `auth.aiDisclosure`) may stay in the locale files harmlessly. Cleanup is
  optional and out of scope unless trivially safe.
- If any new key is introduced, it must be added to all 11 locales
  (en/zh/ja/ko/es/de/fr/pt/it/ar/hi) with `tOr(key, fallback)` used in code.

## Out of scope

- Backend / auth provider logic — untouched.
- The marketing landing page and other routes — untouched.
- Removing unused i18n keys across all locales (optional cleanup only).

## Verification

- `cd frontend && npm run build` must pass (not just `npm run dev`).
- Golden path in a browser:
  - `/auth` page: Google sign-in entry, Microsoft sign-in entry, email
    magic-link submit → `emailSent` success state → resend cooldown.
  - `AuthModal`: open the modal and confirm the decoupled `AuthFormContent`
    renders correctly (buttons, divider, input visible and styled).
  - Light and dark mode both verified.
- Visual check: confirm none of the seven AI-cliché elements remain.

## Risks

- **Modal regression**: decoupling `AuthFormContent` changes its base styling;
  the modal must be re-checked since it previously depended (incorrectly) on
  the absence of theme remapping. Mitigated by explicit modal verification.
- **Stitch variant drift**: Stitch output may reintroduce gradients/glass.
  Mitigated by treating the decisions table as hard constraints when selecting
  and implementing.
