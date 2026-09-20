# DocTalk frontend — measured current state (2026-09-20)
All numbers verified by grep/find in worktree `frontend-design-review-c26fcb`, not recalled.

## Scale
- 91 `page.tsx` routes total. 46 of them render `MarketingShell` (the editorial surface).
- Top-level route groups: [locale], about, admin, alternatives, auth, billing, blog, collections,
  compare, contact, d, demo, document-diff, features, imprint, pricing, privacy, profile, shared,
  terms, tools, trust, use-cases.
- 11 locales (en zh ja ko es de fr pt it ar hi). `ar` = RTL. Only `en` statically loaded.

## FOUR live visual systems (CLAUDE.md claims TWO — that claim is stale)
1. `.dt-editorial` (frontend/src/app/editorial.css, 417 lines) — warm paper #eae8e3, ink #20211e,
   terracotta signal #a04b34, slate #1f3a4d, olive #3f6a34. Fraunces serif + IBM Plex Mono.
   **Declared light-only.** Has `.ed-glass` material tokens (blur 22px saturate 150%, radius 22px),
   a paper-grain SVG turbulence ::before and an ambient radial-gradient ::after.
   Consumers: 46 marketing routes.
2. `--workbench-*` (globals.css) — blue-grey AI-canvas: bg #f6f8fc, canvas #eef3fb, translucent panels,
   dotted grid `--workbench-grid`, cyan glow, `--workbench-command-shadow: 0 22px 70px`.
   Classes `.dt-workbench-canvas`, `.dt-glass-panel`, `.dt-shell-header`, `.dt-workbench-pill`,
   `.dt-workbench-button`, `.dt-command-bar` (globals.css:264-355).
   **76 references across 11 components** incl. PublicHeader, AppHeaderShell, ChatPanel,
   MessageBubble, DashboardPageClient, ThemeSelector, LanguageSelector, AdminCharts, CookieConsentBanner,
   landing/HeroArtifact. => LIVE, not stale.
3. `--reader-*` (globals.css) — a THIRD palette, warm cream: bg #f4f1ea, panel rgba(255,255,255,.9),
   border #ded8ce, ink #1f2933, evidence gold #b7791f.
   Consumers: DocumentReaderPageClient, Chat/{SourcesStrip,DomainModeSelector,CitationCard,MessageBubble,
   ChatArtifactCard,PlusMenu}, Quotes/{BiblioForm,QuoteFinderPanel}. => LIVE.
4. Base zinc + blue `--accent:#1D4ED8` / dark `#60A5FA`, `--surface-1..3`.
   Consumers: about, contact, imprint, privacy, terms, blog/*, billing, profile, auth.

=> The document reader shows systems 2, 3 and 4 simultaneously (blue-grey header over cream reader
   over zinc controls). This is visible in the live app.

## Typography — FOUR families loaded (layout.tsx:1-39)
- IBM Plex Sans  400/500/600/700  → `--dt-body`, Tailwind `sans`   (body + app UI)
- Sora           500/600/700      → `--font-logo`, Tailwind `display` AND `logo` AND `serif`(!)
- Fraunces       normal+italic, axes opsz+SOFT → `--dt-serif` (editorial headlines)
- IBM Plex Mono  400/500          → `--dt-mono` (editorial labels/eyebrows)
NOTE: CLAUDE.md says the body font is Inter. It is not — it is IBM Plex Sans. Doc is stale.
NOTE: tailwind.config aliases `font-serif` → Sora with the comment "the Stitch direction is rounded
  sans display type, not editorial serif" — i.e. a FIFTH abandoned direction still shows in the config.
- Max weight available anywhere: 700 (Plex Sans 700, Sora 700, Fraunces variable).
- Per-script `:lang()` overrides map zh/ja/ko/ar/hi onto system stacks (good, keep).

## Geometry
- Radius utilities by frequency: rounded-l* 238, rounded-m* 116, rounded-f(ull) 94, rounded-x* 70,
  rounded-s* 30, rounded-2xl 20, arbitrary `rounded-[..]` 8, plus t/b/r/i variants.
  => at least 6 competing corner radii in the app surface; editorial adds `--ed-radius: 22px`.

## Motion
- Tailwind keyframes: fade-in 150ms, slide-up 200ms, reveal-up 600ms ease-out.
- `prefers-reduced-motion` IS handled in components/spell/* (ShimmerBadge, StaggeredReveal, TextMarquee,
  TiltCard, BlurReveal), TextViewer, and one globals.css rule (.pdf-evidence-line).
  Not verified for ScrollReveal / editorial ambient.

## Theming
- ThemeProvider: `attribute="class" defaultTheme="system" enableSystem themes={['light','dark']}`.
  => follows the OS by default (HIG-compliant). BUT `.dt-editorial` is light-only, so 46 of 91 routes
  ignore a user's dark preference.

## Known landmines (must not be "cleaned up" during execution)
- globals.css:728-735 `.dt-stitch-root > .min-h-screen{background:transparent!important}` and the
  editorial.css:52-55 counter-rule that defeats it. Removing one without the other breaks the paper bg.
- react-pdf assets in public/ (cmaps, standard_fonts, pdf.worker.min.mjs) — same-origin for CSP.
- Locale JSONs use FLAT DOTTED KEYS; a nested key breaks `next build` but not tsc/eslint.
