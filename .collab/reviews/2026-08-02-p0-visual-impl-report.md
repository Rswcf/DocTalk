# Wave Visual Report — Tasks C1, C2, B3

Executed in order: C1 → C2 → B3, one commit per task, verified with `npx tsc --noEmit` + `npx next lint --quiet` after each. No `npm run build` was run (per instructions). No second dev server was started; none was checked/needed since only tsc/lint were used.

## Commits

1. `ae83e1f` — `fix(ui): restore light-mode visibility for chat controls de-glassed in 0b7404a`
2. `1523370` — `fix(ui): restore light-mode visibility for shell/dashboard chrome`
3. `5cb74dc` — `feat(demo): share affordance for anonymous users + upload CTA lands on dashboard`

## Task C1 — Chat surfaces (MessageBubble.tsx, ChatPanel.tsx)

All mapping-table line numbers matched current source almost exactly (off by 0-1 lines). Surface confirmation before editing: `.dt-answer-card` (globals.css:540-547) = `#ffffff` light / `#18181b` dark; `.dt-empty-workbench` (:502-507) = `#ffffff`/`#18181b`; `.dt-composer` (:676-680) = `#ffffff`/`#18181b`. All target sites confirmed sitting on white-in-light surfaces.

| Site | Old | New | Decision |
|---|---|---|---|
| MessageBubble :285-287 typing dots ×3 | `bg-white/55` | `bg-zinc-400 dark:bg-zinc-500` | Fixed |
| MessageBubble :313 streaming caret | `bg-white/45` | `bg-zinc-400 dark:bg-white/45` | Fixed |
| MessageBubble :336 copy button | `hover:bg-white/10 hover:text-white` | `hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white` | Fixed |
| MessageBubble :347 thumbs-up (inactive) | `hover:bg-white/10 hover:text-white` | same pattern | Fixed |
| MessageBubble :360 thumbs-down (inactive) | `hover:bg-white/10 hover:text-white` | same pattern | Fixed |
| MessageBubble :372 share button | `hover:bg-white/10 hover:text-white` | same pattern | Fixed |
| MessageBubble :382 regenerate button | `hover:bg-white/10 hover:text-white` | same pattern | Fixed |
| ChatPanel :489 empty-state divider | `border-white/10` | `border-zinc-200 dark:border-white/10` | Fixed |
| ChatPanel :494 "01" tile | `border-white/14 bg-white/8 text-white/72` | `border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-white/14 dark:bg-white/8 dark:text-white/72` | Fixed |
| ChatPanel :546 scroll-to-bottom btn | `border-white/14 bg-white/10 … hover:text-white` | `border-zinc-200 bg-white … hover:text-zinc-900 dark:border-white/14 dark:bg-white/10 dark:hover:text-white` | Fixed |
| ChatPanel :557 demo progress track | `bg-white/10` | `bg-zinc-200 dark:bg-white/10` | Fixed |
| ChatPanel :595 "sign in for unlimited" | `hover:text-white` | `hover:text-zinc-900 dark:hover:text-white` | Fixed |
| ChatPanel :644 composer share button | `hover:bg-white/10 hover:text-white` | `hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white` | Fixed (this is the 6th of "~6 action button sites") |
| ChatPanel :653 composer placeholder | `placeholder:text-white/38` | `placeholder:text-zinc-400 dark:placeholder:text-white/38` | Fixed |
| ChatPanel :691 disclaimer | `text-white/36` | `text-zinc-400 dark:text-zinc-500` | Fixed |

Post-fix sweep (`grep -n "white/"`) on both files: every remaining hit is `dark:`-prefixed (verified by inspection, no unprefixed survivors). No additional invisible sites found beyond the table in C1.

**Step 2 — aria progressbar fix**: `role="progressbar"` at ChatPanel:558-568 had `aria-valuenow={messagesUsed}` while the visual bar width is driven by `demoRemaining` (a different, inverse quantity — remaining vs. used). Changed to `aria-valuenow={Math.max(0, demoRemaining)}` and added `aria-valuetext={t('demo.questionsRemaining', { remaining: Math.max(0, demoRemaining), total: maxUserMessages })}` — reusing the existing `demo.questionsRemaining` i18n key already used at ChatPanel:593 for the plain-text equivalent, so no new locale keys were needed (all 11 locales already covered). `aria-valuemax={maxMessages}` was left as-is: `maxMessages = maxUserMessages ?? 0` in `useChatStream.ts:79`, and this whole block is gated by `maxUserMessages != null`, so `maxMessages === maxUserMessages` here always — no mismatch to fix.

Side effect: after removing the only use of `messagesUsed` in aria-valuenow, the destructured binding at ChatPanel:162 became dead. Removed it from the `useChatStream()` destructure to avoid an unused-var lint warning (hook itself still returns/computes it for other future consumers).

## Task C2 — Shell, dashboard, header

Surface confirmation: `.dt-shell-header` (globals.css:375-380) = `#ffffff` light; `.dt-stitch-card` (:802-806) = `#ffffff` light; `.dt-command-bar` (:429-432) = `#ffffff` light. All target sites confirmed on white-in-light surfaces.

| Site | Old | New | Decision |
|---|---|---|---|
| AppHeaderShell :36 Beta badge | `border-white/18 bg-white/8` | `border-zinc-300 bg-zinc-100 dark:border-white/18 dark:bg-white/8` | Fixed |
| PublicHeader :28 Beta badge | same | same | Fixed |
| AppHeaderShell :40 breadcrumb slash | `text-white/25` | `text-zinc-300 dark:text-white/25` | Fixed |
| Dashboard :392 icon tile | `bg-white/12 text-white` | `bg-zinc-900/5 text-zinc-700 dark:bg-white/12 dark:text-white` | Fixed |
| Dashboard :424 dismiss-nudge icon button | `hover:bg-white/10 hover:text-white` | `hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white` | Fixed |
| Dashboard :661 delete-doc icon button | same pattern | same pattern | Fixed |
| Dashboard :437-438 drag-drop border (`dt-command-bar`) | `isDragging ? 'border-white/40 bg-white/10' : 'border-white/18'` | `isDragging ? 'border-accent bg-accent/5 dark:border-white/40 dark:bg-white/10' : 'border-zinc-300 dark:border-white/18'` | Fixed. Used the existing Tailwind `accent` token (`tailwind.config` maps it to `--accent` = `#1D4ED8`) for the active-drag state rather than zinc, since it's a meaningful state change, not decoration |
| Dashboard :482 URL input | `border-white/14 bg-white/8 … placeholder:text-white/38` | `border-zinc-300 bg-white … placeholder:text-zinc-400 dark:border-white/14 dark:bg-white/8 dark:placeholder:text-white/38` | Fixed |
| Dashboard :511 "try demo" link | `hover:text-white` | `hover:text-zinc-900 dark:hover:text-white` | Fixed |
| Dashboard :588 "upload your own" link | `hover:text-white` | `hover:text-zinc-900 dark:hover:text-white` | Fixed |
| Dashboard :542 empty-state tile | `border-white/14 bg-white/8 text-white` | `border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/14 dark:bg-white/8 dark:text-white` | Fixed |

**Additional finding during sweep (not in mapping table)**: PublicHeader.tsx:36, public nav link hover — `hover:bg-white/10 hover:text-zinc-950 dark:hover:text-white`. The `hover:bg-white/10` had no `dark:` prefix, so on the white `.dt-shell-header` surface in light mode a hover produced an essentially invisible ~10%-opacity-white wash on a white background (text stayed readable via `text-zinc-950`, but the hover *background* affordance was imperceptible). Fixed to `hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white`.

**Skip-rule sites confirmed correct, left untouched** (per brief's explicit callout): DashboardPageClient.tsx:463 and :502 — upload/URL error CTA links using `bg-zinc-900 ... text-white ... dark:bg-zinc-50 dark:text-zinc-900`. These invert background per theme (dark button in light mode, light button in dark mode) so bare `text-white` is always correct against the always-dark `zinc-900` light-mode background — no `white/NN` opacity utility involved, and they don't even match the `grep "white/"` pattern.

Post-fix sweep on all three files: every remaining `white/` hit is `dark:`-prefixed. No further invisible sites found.

## Task B3 — Anonymous share affordance + demo-cap CTA callback

Implemented exactly per brief, in `ChatPanel.tsx`:

1. Added `handleAnonShareClick` (new `useCallback`, empty deps) right after `handleShareAnswerVoid`, firing `trackEvent('upgrade_click', { source: 'demo_share_attempt' })` then `openAuthModal()`, with the accepted-tradeoff comment about transcripts not surviving signup.
2. Message-level share: `onShareAnswer={userPlan ? handleShareAnswerVoid : handleAnonShareClick}` (was `... : undefined`). `MessageBubble`'s prop type is `(message: Message) => void`; assigning the zero-arg `handleAnonShareClick` is valid TS (fewer params is assignable) — confirmed by clean `tsc --noEmit`.
3. Composer share button: changed the render gate from `messages.length > 0 && !isStreaming && userPlan &&` to `messages.length > 0 && !isStreaming &&` (button now always renders once there's a message), and `onClick` from `handleShare` to `userPlan ? handleShare : handleAnonShareClick`. `disabled={shareLoading}` was left as-is — `shareLoading` is only ever set `true` inside `handleShare` (the authed path), so it stays `false` and non-blocking for anonymous clicks.
4. Demo-cap CTA: `handleDemoAuthClick` — `openAuthModal()` → `openAuthModal({ callbackUrl: '/' })`, so "Upload your own document" lands on the dashboard post-signin.

No new i18n keys were introduced by B3 (button copy/labels are unchanged; only click targets and a render gate changed).

`userPlan` semantics check (to confirm `!userPlan` reliably means "anonymous", not "still loading" for a logged-in user): `useUserPlanProfile.ts:34` sets `userPlan: profile?.plan || (isLoggedIn ? 'free' : undefined)` — the moment `useSession()` reports `authenticated`, `userPlan` is truthy (`'free'` as floor) even before the profile fetch resolves. So `userPlan` is `undefined` only for genuinely anonymous/unauthenticated sessions, not a loading flicker for logged-in users — the gate change is safe.

## Verification evidence

Ran after every task:
```
cd frontend && npx tsc --noEmit    → clean (no output) all 3 times
cd frontend && npx next lint --quiet → "✔ No ESLint warnings or errors" all 3 times
```
Final combined pass after all three tasks: both clean again.

Palette-rule spot check (global-constraints.md): `grep -rn "gray-\|indigo-\|violet-\|purple-\|transition-all"` across all 5 touched files → zero hits (excluding none needed, no Google-brand exception triggered either).

No `npm run build` was run per the constraint against running it while a dev server may be active (integration phase owns that verification).

## Files changed

- `frontend/src/components/Chat/MessageBubble.tsx`
- `frontend/src/components/Chat/ChatPanel.tsx`
- `frontend/src/components/AppHeaderShell.tsx`
- `frontend/src/components/PublicHeader.tsx`
- `frontend/src/components/dashboard/DashboardPageClient.tsx`

## Concerns

- None blocking. The `border-accent bg-accent/5` treatment for the active-drag dashboard drop zone (Dashboard :437-438) is not a judgment call — the brief specifies that exact string verbatim (brief line 55: `isDragging ? 'border-accent bg-accent/5 dark:border-white/40 dark:bg-white/10' : 'border-zinc-300 dark:border-white/18'`), applied as written.
- The additional PublicHeader.tsx:36 fix (nav-link hover background) was not in the mapping table; found and fixed during the mandated sweep step per the brief's own instructions ("Fix any additional invisible ones the same way").

Report path: `/Users/mayijie/Projects/Code/010_DocTalk/.superpowers/sdd/2026-08-02-p0-demo-retune-ui-fixes/wave-visual-report.md`

---

## Fix Round 1 (review findings)

Addressed three findings from the W2 review. Commit: `db7d263`.

**IMPORTANT-1 — thumbs-up active state invisible in light mode.** `MessageBubble.tsx:346` (in the same feedback-button hunk fixed in C1, ~4 lines above the already-fixed inactive-state hover pattern): the ternary's active (`feedback === 'up'`) branch was bare `'text-white'` with no `dark:` split, sitting on the white `.dt-answer-card` surface — once a user marked an answer helpful, the thumbs-up icon vanished in light mode. This was missed in the original C1 pass because the grep pattern `hover:text-white` doesn't match a bare unconditional `'text-white'` string in a ternary. Fixed following the sibling pattern (thumbs-down active branch already used `'text-red-500 dark:text-red-400'`): changed to `'text-accent dark:text-white'` — `text-accent` confirmed as an established class elsewhere in the codebase (e.g. `Footer.tsx:81,96,111,126,164`). Light mode now shows the app accent blue on an active thumbs-up; dark mode keeps the prior white appearance unchanged.

**SWEEP-GAP-2 — bare `text-white`/`bg-white` sweep.** Ran `grep -noP '(?<!dark:)(?<!:)(bg-white|text-white)(?!/)\b'` across all five touched files (a stricter form of the requested `grep -n "text-white\|bg-white"` that isolates bare/no-opacity hits even when they share a line with an already-fixed `white/NN` token). Results, all audited against the same surface-judgment rule:

| Site | Value | Surface | Decision |
|---|---|---|---|
| MessageBubble.tsx:151 | `bg-white` (code block, `<pre>`) | Paired with `dark:bg-zinc-900` — intentional light-mode white code-block background, not a de-glassing leftover | Skipped — correct as-is |
| MessageBubble.tsx:274 | `text-white` (error message bubble) | On `bg-red-500/92` — a permanently-colored surface, not theme-dependent; white text is always legible on solid red | Skipped — correct as-is |
| MessageBubble.tsx:346 | `text-white` (thumbs-up active) | On white `.dt-answer-card` | **Fixed** (IMPORTANT-1, above) |
| ChatPanel.tsx:552 | `bg-white` (scroll-to-bottom button) | Paired with `dark:bg-white/10`, part of the C1 mapping-table fix already landed (`border-zinc-200 bg-white ... dark:border-white/14 dark:bg-white/10`) | Skipped — correct as-is |
| DashboardPageClient.tsx:463 | `text-white` (upload-error CTA link) | `bg-zinc-900 ... dark:bg-zinc-50 dark:text-zinc-900` — the theme-inverting kind the review explicitly called out as known-correct | Skipped — correct as-is |
| DashboardPageClient.tsx:482 | `bg-white` (URL input) | Paired with `dark:bg-white/8`, part of the C2 mapping-table fix already landed | Skipped — correct as-is |
| DashboardPageClient.tsx:502 | `text-white` (URL-error CTA link) | Same theme-inverting pattern as :463 | Skipped — correct as-is |
| DashboardPageClient.tsx:626 | `text-white` (delete-confirm "Yes" button) | On `bg-red-600 hover:bg-red-500` — permanently-red action button, not theme-dependent | Skipped — correct as-is |

No fixes needed from this sweep beyond the one already covered by IMPORTANT-1 — every other bare `white` hit is either paired with a `dark:` counterpart (already correct) or sits on a permanently-colored (non-theme-toggling) surface.

**REPORT-FIX-3 — Concerns section corrected.** The original Concerns paragraph mischaracterized the Dashboard drag-drop `border-accent bg-accent/5` treatment as an undocumented judgment call; corrected above — the brief specifies that exact string verbatim at line 55, applied as written, not a deviation.

**Verification**: `npx tsc --noEmit` clean, `npx next lint --quiet` → "✔ No ESLint warnings or errors". No `npm run build` run (same constraint as before).
