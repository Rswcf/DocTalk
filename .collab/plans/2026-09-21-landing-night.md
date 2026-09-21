# Landing "Night" (prototype B) — implementation plan

**Date** 2026-09-21 · **Decision** owner chose B · Night (closed; this plan is the HOW) · **Executor** Claude · **Review** Fable after slice 2, Codex on 2026-09-23 · **Branch** child branch `claude/landing-night` off `claude/frontend-design-review-c26fcb` (so Night and the four unpushed Phase 2a commits can merge in either order) · **Spec** `design-explorations/2026-09-21-citation-field/{b-dark.html,citation-field.js}`.

## 0. Status and owner amendments (2026-09-21)
Slices 1–3 built (`7ee6637`, `cab3bd8`, `c26a2e8`). Then three owner decisions changed this plan:
1. **Prototype B's look, not the plan's compromise** (`f095f20`): stage `#0a0908` via one night-only value block (the sanctioned exception to §2's twin rule) and Geist display type (`geist` package) instead of §3's Fraunces.
2. **Night on every marketing page** (§13 Q1 answered "yes"): `MarketingShell` renders the same `NIGHT_ROOT_CLASS` as the landing (`components/marketing/night.ts`); display type flows through `--ed-display-family`. A CDP contrast audit of 54 marketing pages in a light OS found zero text below AA.
3. **Release pairing** (§13 Q2): ship together with the four Phase 2a commits in one release after Codex's review on 2026-09-23.

## 1. Scope
Night = the unauthenticated landing only: `app/page.tsx` → `HomePageClient` → `LandingPageContent`, and `app/[locale]/page.tsx`. Header and footer on those routes go Night through tokens (no edits to `EditorialHeaderBase`/`EditorialFooter`). Every other marketing page stays paper-light / system-dark. Follow-up, not built: extending Night is one class on `MarketingShell.tsx:23` — owner call after seeing `/` live (§13).

## 2. Theme
Night in both OS themes. No toggle exists on the marketing surface (`useTheme` appears only in `ThemeSelector.tsx`, `UserMenu.tsx`), so nothing to remove.

Mechanism: `LandingPageContent.tsx:25` root becomes `dt-editorial dt-night`. In `editorial.css` every `.dark .dt-editorial…` selector gains the twin `.dt-editorial.dt-night…` **in the same selector list** — three sites today: `:102` (token set), `:170` (grain), `:820` (`.ed-frame-page`, deleted in slice 2). Zero new token names, zero second value set: the ~40 inline `var(--ed-paper-2)` consumers and the `!important` counter-rule (`:150-153`) follow automatically; `color-scheme: dark` comes with the block.

Stage colour = the existing dark `--ed-paper` **`#171614`**, not B's `#0a0908`: every dark token (glass, rule, ink-2/3, chip, footer) is measured against `#171614`; deeper would be one override plus re-mixing ~8 dependents. Say this at the slice-1 checkpoint — the owner approved screenshots on the deeper stage. Raise the canvas `dimAlpha` from B's 0.16 to ~0.20 on the lighter ground.

Chrome rendered outside the landing root follows `.dark` on `<html>`, not `.dt-night`, so a light-OS first visit would paint paper on black. Fix both in slice 1: `CookieConsentBanner.tsx:13` (detects `#page-content .dt-editorial`, wraps itself in `.dt-editorial` at `:111`) also checks `classList.contains('dt-night')` and mirrors the class; `EdLanguageSelector.tsx:129/227` (portal to `document.body`) mirrors `dt-night` when its trigger has a `.dt-night` ancestor (`closest`). `AuthModal` (zinc, `AuthModal.tsx:130`) stays mismatched until Phase 3 — accepted.

`theme-color`: `layout.tsx:93-94` stays; `LandingPageContent` sets both `meta[name=theme-color]` to `#171614` on mount and restores on unmount (a page-level `viewport` export would also tint the signed-in dashboard, which renders at the same route).

Known regression, named: signed-in visitors see the landing during `status === 'loading'` (`HomePageClient.tsx:28`); that flash becomes black→white. Not fixable here (crawlers need the landing in SSR HTML); the 09-20 plan (line 339) already schedules it for Phase 3.

## 3. Typography
Fraunces 600 through the existing `.ed-display` (`editorial.css:222-231`), solid `--ed-ink`, no gradient clip, no −0.045em. It is the sanctioned display voice one click from `/pricing`, and "gradient + Geist" was the Linear-template critique. No `geist` dependency (Next 14.2's `next/font/google` has no Geist). Canvas text = Plex Sans read from computed style (§4). `:lang` degradation (`:434-458`) applies unchanged.

## 4. Hero composition
Files: `components/landing/CitationField.tsx` (client; port of `citation-field.js`), `components/landing/citationFieldContent.ts` (`PARAGRAPHS`, `CITED`, `DOC_NAME`; no React), `HeroSection.tsx` rewritten, an `.ed-night-*` block in `editorial.css`.

Markup, SSR, real text first: `<section class="ed-night-stage">` → `<canvas aria-hidden>` inside a `dir="ltr" lang="en"` wrapper (absolute, z −1, B's masks) → `.ed-night-claim`: h1 `.ed-display` from `landing.headline` (split on `\n` as today), lede `.ed-lede`, `.ed-cta` → `/demo`, plain `<a href="#auth">` `.ed-link` — keep the hashchange comment at `HeroSection.tsx:60-62` and both `trackEvent` calls → `<figure>` answer card + `sr-only` `landing.frame.description` → `<p class="ed-night-note">` `landing.frame.quoteFinder`.

Canvas contract:
- **Colours** read at mount and on resize via `getComputedStyle(canvas).getPropertyValue`: `--ed-paper` (stage), `--ed-ink` (ink, citedInk), `--ed-evidence` (bloom, badge fg/border), `--ed-evidence-soft` (highlight fill, badge bg). A hex→rgb helper builds alpha strings; the component contains no colour literal (test). No theme observer needed — `.dt-night` values never change.
- **Font**: `.ed-night-field { font-family: var(--dt-body) }`; `ctx.font = \`${weight} ${size}px ${getComputedStyle(canvas).fontFamily}\`` — next/font's generated family name resolves; `document.fonts.load()` gets the same string; the 1.2 s race stays.
- **Loop**: rAF runs from start until `cited` fires, draws one final frame, cancels. `breathe` is deleted. `pointermove` (pointer: fine only) restarts the loop; it stops again once `cursor.a < 0.01` after `pointerleave`. Resize → `resize()` → one `draw`. IntersectionObserver keeps the `visible` gate.
- **Lifecycle**: cleanup cancels rAF, disconnects both observers, removes listeners; a `mounted` flag guards the font-promise `.then` — the landing mounts and unmounts within ~300 ms for every signed-in visitor.
- **Reduced motion / still**: `(prefers-reduced-motion: reduce)` or `/[?&]still\b/.test(location.search)` → one final frame and `.is-still` on the stage (no CSS entrance). `?still` is for screenshots and verification.
- **Events → props**: `onLayout({ citedY, anchor })`, `onCited()`. HeroSection positions the desktop card from `onLayout` (`top = citedY + 36px`, `left: calc(50% + 150px)`, clamped inside the stage) — B's fixed `bottom: 30px` drifts ~60 px between 900 and 1080 stage heights. `onCited` adds `is-cited` (rise). The card is visible without JS; the client adds `is-armed` at mount.
- **Height**: desktop `min-height: 860px; min-height: max(860px, 100svh)` — `svh` is fixed per orientation, so collapsing toolbars never move the citation. ≤767 px: claim in flow, then a fixed 420 px canvas region (`focusY` .55, `pad` 22), then the card in normal flow beneath — B clipped it below the fold (`b-375.png`).
- **RTL**: the wrapper's `dir="ltr" lang="en"` (an English document, as `ProductFrame.tsx:84-89`); the card keeps physical `left` on desktop (it annotates the LTR document) and inherits `dir` for its own text.
- **Pool behind the claim**: `background: var(--ed-paper); background: radial-gradient(closest-side, color-mix(in srgb, var(--ed-paper) 97%, transparent), transparent)` — no `--ed-paper-rgb` token; browsers without `color-mix` get the opaque first line.

## 5. Fixes to B's weaknesses
| B | Port |
|---|---|
| khaki highlight `rgba(240,179,35,.28)` | fill `--ed-evidence-soft`, cited words `--ed-ink`. **Acceptance at slice 2**: reads as a highlight at 1440 and 375; if not, add a 1 px `--ed-evidence` rule under the span — the fallback is named, not silent |
| gradient-clipped Geist h1 | `.ed-display` (§3) |
| floating glass pill nav | keep the sticky full-width glass header (`EditorialHeaderBase.tsx:62-64`) — functional layer, dark glass already mixed |
| translucent `.trio` cards | not ported; FeatureGrid stays hairline rows |
| glass `.answer` | opaque `.ed-card` material (`--ed-surface`, `--ed-rule`, `--ed-shadow-card`, `--ed-r-3`); rows reuse `.ed-frame-a/-cite/-source*` (`editorial.css:740-792`); the question line is a new `.ed-night-q` (13 px, `--ed-ink-3`) — `.ed-frame-q` (`:730-739`) is an end-aligned bubble, wrong inside a 340 px card |
| amber glow under the CTA | `.ed-cta` as is |
| `white-space: nowrap` actions | `flex-wrap` as today (`HeroSection.tsx:52`) |

## 6. Rest of the landing
Tokens flip; no structural change. Spot-check `SecuritySection.tsx:17` (inline `var(--ed-paper-2)` band) and `EditorialFooter`. `FinalCTA` keeps its filled `.ed-cta`; the stage's CTA never shares a view with it.

## 7. Quote Finder and ProductFrame
Quote Finder is named by `landing.frame.quoteFinder` (present ×11) as the hero footnote under the stage. `ProductFrame.tsx` is **deleted** in slice 2 with its shell CSS — `editorial.css:673-739` (`-figure/-frame/-bar/-mark/-doc/-pageno/-body/-chat/-q`), `:800-860` (`-pane/-page*/-mark-cited/-badge`), `:862-876` (`-caption`, phone block); `-a/-cite/-source*` stay for the card. Phase 4's visual-spec pointer becomes `git show v0.31.0:frontend/src/components/landing/ProductFrame.tsx`, recorded in the 09-20 plan §10 Q1 (line 405).

## 8. Document sample
Keep Alphabet page 1. Verified today: all 13 `PARAGRAPHS` (`citation-field.js:22-36`) are verbatim in `pdftotext -f 1 -l 1 backend/seed_data/alphabet-earnings.pdf`; `CITED` (`:37-38`) equals `ProductFrame`'s `PAGE_CITED`. The `/demo` CTA opens the same seed set. Replacement constraint (docblock of `citationFieldContent.ts`): page 1 of a `backend/seed_data/` PDF, copied verbatim (the test checks), `CITED` must be the sentence the live product cites for `landing.frame.question`, and `landing.frame.{question,answer,source,description}` change together in all 11 locales. Google/Gemini/YouTube marks are quoted from a public release (nominative use); the 2026 guidance dates the sample — revisit when the seed set changes.

## 9. i18n
Reused unchanged (all ×11): `landing.headline`, `landing.description`, `landing.cta.demo`, `hero.signUpFree`, `landing.frame.question`, `landing.frame.answer`, `landing.frame.description`, `landing.frame.quoteFinder`. New: `landing.frame.source` = "Alphabet Q4 2025 earnings release, p. 1" (after the chip "1"). Retired, left in the JSONs like `landing.heroStats.*`: `landing.frame.caption`. Rule: slice 2 ships the new key via `tOr`; slice 3 adds the 10 translations and the test turns strict. SEO untouched: `landing.metaTitle/metaDescription`; JSON-LD still reads `landing.description`.

## 10. Tests
Existing: `marketing-jsonld.test.cjs:458-520` (HomeJsonLd + `landingSchemaSources`) and `seo-meta-keys.test.cjs` assert sources the hero does not touch — must stay green. `scripts/check-chat-prompt-i18n.js` unaffected. New `tests/landing-night.test.cjs`:
(a) `CITED` ⊂ `PARAGRAPHS`, and every paragraph ⊂ `pdftotext` page 1 (skip with a notice if `pdftotext` is absent);
(b) `CitationField.tsx`, comments stripped, has no quoted hex colour (`/['"]#[0-9a-f]{3,8}\b/i`) and no `'IBM Plex Sans'|Geist|system-ui`;
(c) every `.dark .dt-editorial` selector in `editorial.css` has a `.dt-editorial.dt-night` twin in the same list;
(d1) `LandingPageContent` root has `dt-editorial dt-night`; (d2, slice 2+) `HeroSection` imports no `ProductFrame` and `ProductFrame.tsx` is absent;
(e) `landing.frame.source` non-empty ×11 (slice 3);
(f) `CookieConsentBanner` and `EdLanguageSelector` reference `dt-night`.

## 11. Rules and docs
- `.claude/rules/frontend.md`, "Editorial marketing layer" bullet, append: "**Night landing (2026-09-21, owner chose prototype B):** the `/` and `/[locale]` root is `.dt-editorial.dt-night`, which applies the dark `--ed-*` set in both OS themes via the SAME selector lists as `.dark .dt-editorial` — never a second token set or new names; portalled chrome (cookie banner, language popover) mirrors the class. The hero is the `CitationField` canvas (every colour and font from computed `--ed-*`/`--dt-body`, no literals; rAF stops after `cited`) plus a real-text claim and an opaque `.ed-card` answer. Other marketing pages stay paper-light / system-dark until the owner extends Night. This amends the 09-20 'one surface treatment' clause only; identity (terracotta, Fraunces, Plex, olive/amber roles) is unchanged." (`frontend.md` never names `ProductFrame`; nothing else to remove.)
- `.collab/plans/2026-09-20-apple-design-direction.md`: Status line + §10 Q1 consequence: landing hero superseded by this plan, `ProductFrame` deleted, Phase 4 spec pointer = the v0.31.0 tag.
- `AGENTS.md` only references `rules/frontend.md` (`AGENTS.md:85`); `CLAUDE.md` imports it — no edits.

## 12. Slices (one commit each; builds and tests green)
1. **Night ground** — `editorial.css` (three twins), `LandingPageContent.tsx` (class, theme-color effect, and its `:13-16` docblock, which still says light-only/Newsreader/Plex Mono), `CookieConsentBanner.tsx`, `EdLanguageSelector.tsx`, tests (c)(d1)(f). Verify: `npm run build`, `npm run test:unit`; `/`, `/de`, `/ar` in light AND dark OS = Night with the current hero; `/pricing` still paper; open the language popover and the cookie banner on a light OS.
2. **Citation field hero** — *first visible milestone for the owner* — `CitationField.tsx`, `citationFieldContent.ts`, `HeroSection.tsx`, `.ed-night-*` CSS, delete `ProductFrame.tsx` + shell CSS, `en.json` key, tests (a)(b)(d2). Verify: build/tests; 1440 and 375 (`?still` and live); reduced-motion emulation; `/ar` (canvas LTR, UI RTL); `/de`, `/fr`, `/pt` action wrapping; DevTools performance shows no rAF after ~4 s idle; golden path from the CTA (demo → chat → citation jump). Owner reviews the §2 stage note and the §5 highlight criterion here.
3. **Translations and docs** — 10 locale JSONs (`landing.frame.source`), test (e) strict, `frontend.md`, 09-20 plan, memory note. Verify: build/tests; `/ja` and `/ar` card copy.

Fable review after slice 2; Codex reviews all three with Phase 2a on 09-23.

## 13. Owner decisions (two)
1. After slice 2 is live: extend Night to the other marketing pages (one class on `MarketingShell`), or keep them paper?
2. Release pairing: ship Night with the four unpushed Phase 2a commits in one Codex-reviewed release on 09-23, or hold Night for the release after?
