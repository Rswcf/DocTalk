# Phase 1 adversarial review — findings (Fable 5.1, standing in for Codex)

Reviewed: `origin/main..HEAD` (merge-base `b24b143`, 16 commits, 40 files under `frontend/src`
+ plan, contrast script, package files). Read-only; nothing under `frontend/` was edited.
Author: Claude Opus. Reviewer: a different model, per the standing rule.

Verdict is at the end. Severity legend: BLOCKER / MAJOR / MINOR / NIT. "Verified fine"
entries record what was checked and found sound, so the author knows the coverage.

---

## What I re-verified myself vs. accepted

| Author claim | Status | How |
|---|---|---|
| `npm run test:unit` 161/161 | **Re-verified** | ran it: 161 pass, 0 fail (2.6 s) |
| `npm run build` green, 425 pages | **Re-verified** | ran it (no `next` process was running): exit 0, `Generating static pages (425/425)` |
| ProductFrame text verbatim from p.1 of `alphabet-earnings.pdf` | **Re-verified** | `pdftotext -f 1 -l 1 -raw`: title, dateline, lead-in (curly apostrophe `We’re`), cited sentence, closing `”`, "Q4 2025 Financial Highlights" all match byte-for-byte |
| `!important` counter-rule pair intact | **Re-verified** | `globals.css:733-739` (`.dt-stitch-root > .min-h-screen … transparent !important`) and `editorial.css:150-153` (`.dt-stitch-root > .dt-editorial … var(--ed-paper) !important`, (0,3,0)) both present; `MarketingShell` root is still `dt-editorial min-h-screen flex flex-col`, a direct child of `#page-content.dt-stitch-root` |
| Every `upgrade_click` event and `billingHref()` target on /pricing preserved | **FALSE** — see MINOR-1 | old file had three (`pricing_hero` hero CTA + two plan cards); new file has two |
| 60 translations flat, `quoteFinder.title` reused, no word-for-word claim | **Re-verified** | script over all 11 JSONs: 0 nested keys, 6 new keys each, `quoteFinder.title` is a substring of `landing.frame.quoteFinder` in all 11, no verbatim-claim phrase in any language (zh `原文` = "checked against the original text", the honest claim) |
| `EdPageHero variant="default"` unchanged | **Re-verified** | Python byte-compare of the old `return (…)` block vs the new file's last `return (…)`: identical; `hasCta` line unchanged |
| Contrast audit clean | **Re-verified** | `contrast_tokens.py` runs and prints PASS on every parsed token pair (note: it cannot see inline hardcodes — see MAJOR-2) |
| Remotion cluster / HeroCollage / SocialProof / ScrollReveal fully gone | **Re-verified** | code grep: only comments reference them; `package-lock.json` has 0 `remotion` matches |
| Anything that needs a rendered viewport (375×812 fold geometry, banner overlap, dark-mode look) | **Not verified** | no browser in this review; arithmetic only where stated |

---

## MAJOR

### MAJOR-1 — `editorial.css:652-659`: unscoped `prefers-reduced-motion` rule leaks into the app surface and turns infinite animations into flicker

**What.** The rule is deliberately NOT under `.dt-editorial`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

`editorial.css` is imported by `app/layout.tsx:4`, so this applies to every route, including
the reader, dashboard, billing and admin. It omits `animation-iteration-count: 1 !important`,
which the standard reset pattern this follows includes for exactly this reason: an
`infinite` animation with a 0.01 ms period samples a pseudo-random phase on every frame, so an
`animate-spin` icon jitters and an `animate-pulse` skeleton flickers between opacity 1 and
0.5 at frame rate. That is the known mechanism, not something I rendered.

**Exposure (grep, app surface only, no `motion-reduce:` guard on the line):**
`app/demo/[sample]/DemoRedirectPageClient.tsx:57` (32 px spinner on the marketing→demo hop),
`app/demo/DemoPageClient.tsx:179`, `app/admin/AdminPageClient.tsx:191`,
`components/admin/AdminPanels.tsx:97`, `app/billing/BillingPageClient.tsx:714,946,1272`,
`app/profile/ProfilePageClient.tsx:132`, `components/UserMenu.tsx:82`,
`components/CreditsDisplay.tsx:74`, `components/dashboard/DashboardPageClient.tsx:223`
(the "processing" status dot). The chat tree is mostly safe because it already carries
`motion-reduce:animate-none` per site.

**Why it is this diff's problem.** The old `editorial.css` had no reduced-motion rule at all;
the codebase pattern is per-site guards (`globals.css:198` guards `.pdf-evidence-line`
the same way). The rule's own comment gives one justification — the cookie banner's `slideUp`
— but the banner already has `motion-reduce:animate-none` on both branches
(`CookieConsentBanner.tsx:105,157`), so the rule's *only* marginal effect is on everything
else. It also contradicts CLAUDE.md ("Keep editorial styles scoped under `.dt-editorial`; do
not let them leak into the functional app UI"), the file's own first line, and the plan's
Phase 1 exclusion (globals-level motion is Phase 3).

**Failure scenario.** A user with "Reduce motion" on opens `/billing` or the dashboard while a
document is processing: the skeleton cards and the status dot strobe at 60 Hz. Flashing content
is the opposite of what that OS setting asks for.

**Fix (pick one).** (a) Delete the block — the banner is already guarded. (b) Scope it:
`@media (prefers-reduced-motion: reduce) { .dt-editorial *, .dt-editorial *::before,
.dt-editorial *::after { … } }` and add `animation-iteration-count: 1 !important` if kept
anywhere. If the author wants the app-wide floor, it belongs in `globals.css` in Phase 3 with
the iteration-count line, as the plan already schedules.

### MAJOR-2 — `app/shared/[token]/page.tsx:99,103`: user bubbles are `#ffffff` on `var(--ed-ink)`, which this diff makes `#ece9e2` in dark mode

**What.** The shared-answer page (public, no auth, `MarketingShell` root) renders the user's
messages as `{ background: 'var(--ed-ink)', color: '#ffffff' }` and the paragraph as
`color: '#ffffff'`. Before this change set the editorial surface was light-only, so `--ed-ink`
was always `#20211e` and white-on-ink was fine. This diff adds `.dark .dt-editorial
{ --ed-ink: #ece9e2 }` (`editorial.css:107`). `ThemeProvider` is global with
`defaultTheme="system"`, so every visitor with OS dark mode now gets `#ffffff` text on a
`#ece9e2` bubble — roughly 1.1:1, i.e. the question is invisible.

**Why the author missed it.** The plan's execution note #8 counts "9 white hardcodes across
marketing/landing/pricing" — `app/shared/` is not in those directories, so the census did not
reach it. The contrast script only parses token blocks and cannot see inline hardcodes.

**Failure scenario.** Someone shares an answer link; the recipient's phone is in dark mode; the
page shows the assistant's replies but the questions are blank cards.

**Fix.** `color: 'var(--ed-paper)'` on both sites (light: `#eae8e3` on `#20211e` ≈ 13.2:1;
dark: `#171614` on `#ece9e2` ≈ 14.9:1). Same one-line change for any other route under
`MarketingShell` that hardcodes white; the wide grep found only this one and the accepted
`FeatureGrid.tsx:39` (see MINOR-9).

---

## MINOR

### MINOR-1 — `PricingPageContent.tsx`: the `pricing_hero` funnel source is gone; the parent's "every event preserved" claim is false

Old hero had `TrackedCtaLink` → `billingHref({plan:'plus', source:'pricing_hero'})` with
`upgrade_click {plan:'plus', period:'monthly', source:'pricing_hero'}` plus a `tryDemo` link.
The new hero has no CTA at all; the two plan-card events (`source:'pricing'`, plan
`plus`/`pro`) and their `billingHref()` targets are intact (lines 51, 73, 205). This is
**plan-sanctioned** (§7 line 273: "one filled CTA per plan card and none in the hero") and
the Plus card now sits inside the hero's `product` slot, so the above-the-fold Plus action
still exists — it just reports as `pricing` instead of `pricing_hero`. Consequences to record:
`backend/app/api/admin.py:101` (`"pricing_hero": "Pricing page hero"`) and
`backend/scripts/observation_window.py:36` now name a source that can never fire again; the
earlier plan `docs/superpowers/plans/2026-05-19-editorial-marketing-plan-d.md:33` insisted the
hero tracking "must be preserved". Also: commit `61fbccb` fills only Plus and makes Free/Pro
`ed-cta-quiet`, which deviates from the plan's "one filled CTA per plan card" and is not in the
execution notes. Defensible under the one-dominant-action rule; record it there.
`tryDemo` survives at line 370 as an `ed-inline` link in the best-fit section.

### MINOR-2 — `/pricing` heading order now skips h1 → h3

`EdSection` renders `title` as `<h2>` (`EdSection.tsx:44`). Old order: h1 → h2 (credit guide)
→ h3 ×3 (plan names) → h2 → h2. New order: h1 → **h3 ×3** (plans are inside the hero's
`product` slot) → h2 (credit guide) → h2 → h2. Screen-reader heading navigation lands on three
h3s with no h2 parent; axe flags this as `heading-order` (best practice, not a WCAG failure).
Landmarks are unchanged (one `<main>`, breadcrumb nav, header, footer). Fix: either make the
plan names `h2` (they are the page's primary sections now) or put a visually-hidden `<h2>`
("Plans") at the top of the `product` node.

### MINOR-3 — `CookieConsentBanner.tsx:92-152`: the editorial branch ignores `isWorkspaceRoute`

`isWorkspaceRoute` (line 73) lists `/shared/` and `/document-diff`, both of which render
`MarketingShell` → `.dt-editorial` under `#page-content`, so on those two routes the banner
now takes the editorial branch and pins to the **bottom** instead of the top. No harm today:
`/shared/[token]` is a static transcript ending in a "Try DocTalk Free" CTA (no composer), and
`DocumentDiffPanel` has no fixed/sticky bottom controls. But the branch now silently does not
do what it says for half its entries. Fix: either drop those two routes from the list with a
comment, or honour `isWorkspaceRoute` in the editorial branch too.

### MINOR-4 — `CookieConsentBanner.tsx:13,43`: the added `querySelector` roughly doubles an existing per-frame DOM traversal on the app surface

`#page-content .dt-editorial` is a compound descendant selector; Blink/WebKit have no fast
path for it, so each call walks the subtree checking class membership (the existing
`[role="dialog"][aria-modal="true"]` query already does a similar walk). Cost is bounded:
rAF-coalesced (≤60 Hz), only while `visible` (pre-consent), and sub-millisecond on a reader
page (~10 k nodes). On the app surface the answer is always `app`. It is a real but small cost,
not a defect. Cheaper and equally correct: the surface can only change on navigation, so
compute it in a `useEffect(..., [pathname])` (runs after the new page commits) and keep the
observer for dialogs only. No hydration issue: SSR renders `null` (`visible=false`), and the
first client batch sets `surface` and `visible` together.

### MINOR-5 — banner "one compact row on phones" holds only for short-label locales (arithmetic, not rendered)

At 375 px: outer `left-2 right-2` → 359 px; `px-3` → 335 px content; the button group is
`shrink-0`. `en` (`Decline`/`Accept`, 13 px, `px-3`) ≈ 150 px, leaving ≈ 170 px for 40 chars
+ "Learn more" → 3 lines, fine. `hi` (`स्वीकार करें` / `अस्वीकार करें`, 12+13 chars) ≈ 240 px,
leaving ≈ 80 px for 64 chars + link → 8+ lines, ~150 px tall; `de`/`fr`/`it` land at 4–5
lines. The two-row app layout was never "one row" either, so this is not a regression, but the
comment promises something the long locales cannot deliver. Fix: `flex-wrap` on the row so the
buttons drop under the text when the label pair exceeds ~45 % of the width, or drop `shrink-0`.

### MINOR-6 — Plan's own Phase 1 gate "zero text below 12 px" on `/` is not met and not disclosed

`FeatureGrid.tsx` still carries 13 sites at `text-[9px]`/`[10px]`/`[11px]` (lines 35, 38, 59,
77, 93, 96, 100, 103, 168, 171, 197, 200; smallest 9 px). Plan §7 line 277 lists "zero text
below 12px" as a Phase 1 judge criterion for `/` and `/pricing`. `/pricing` is clean
(`ed-caption` is 13 px; `ed-frame-cite` 12 px is the sanctioned tabular-numeral exception).
Pre-existing, unchanged by this diff, but the execution notes should say the gate is deferred
for `FeatureGrid` rather than implying it passed.

### MINOR-7 — Plan §7 line 278 ("Also the moment to rewrite the rule text (§8) — same commit series") was not done

`git diff --name-only` contains no `CLAUDE.md`, `AGENTS.md` or `.claude/rules/*`.
`.claude/rules/frontend.md:20` still says the editorial layer is "**light-only**" and CLAUDE.md
still locks "TWO surface treatments" — both now contradicted by shipped code (`.dark
.dt-editorial`, `theme-color` paper tints). §8's text depends on Open Question 1, which §10
records as answered (A2), so it is decidable. Either land the §8 rewrite in this series or
state in the execution notes that it is deferred and to which commit.

### MINOR-8 — `layout.tsx:93-94`: `theme-color` is root-level (documented-accepted)

The paper/near-black tints now frame the still-white app surface in mobile browser chrome.
Execution note #7 accepts this as "correct-but-early" under A2. Listed so it is on the record;
no action unless Phase 3 slips.

### MINOR-9 — `FeatureGrid.tsx:39`: white label on `--ed-olive` becomes ~1.9:1 in dark mode (documented-accepted)

`--ed-olive` is `#8fc27d` in dark; `text-white` on it fails. Execution note #8 accepts it.
Listed for the record; the fix is `text-[var(--ed-paper)]` — light `#eae8e3` on `#35592c`
(6.55:1), dark `#171614` on `#8fc27d` (8.77:1), so one token works both ways.

---

## NIT

- **`ProductFrame.tsx:32`** — the frame's filename `2025q4-alphabet-earnings-release.pdf` is not
  what the reader shows for this document; the demo seed titles it
  `Alphabet Q4 2025 Earnings Release.pdf` (`backend/app/services/demo_seed.py:30`). The file's
  own honesty note says "nothing here is a feature the reader lacks"; use the real title.
- **`ProductFrame.tsx:88-101`** — the depicted page jumps from the dateline straight to the third
  paragraph of the CEO quote, eliding six bullets and two paragraphs with no ellipsis. Each
  fragment is verbatim (verified) and the pane is `aria-hidden`, so nothing false is asserted,
  but a "p. 1" that reads as contiguous is a small over-tidy. A `…` line between would be honest.
- **`landing.frame.caption`** (all 11 locales) — "Every answer links to the *sentence* it came
  from." Citations are passage/chunk-level with bbox highlights (rules/frontend.md, PDF &
  Documents); "sentence" and "every" both over-promise slightly. `landing.frame.quoteFinder`
  and `pricing.heroLine` are fine.
- **`components/spell/TiltCard.tsx`** — only consumer was `HeroArtifact`, now deleted; dead code
  (plan Phase 5 already lists "unused `spell/*`").
- **Locale files** — `landing.heroStats.*` and `landing.heroEyebrow` are now unreferenced in all
  11 locales (author acknowledges in `HeroSection.tsx:18`).
- **`EdPageHero.tsx:46-88`** — the `product` variant silently drops `meta` and `icon`. Fine for
  the one caller, but a page that migrates and passes `meta` will lose it with no warning; a dev
  `console.warn` or a type-level `never` on those props for the variant would prevent that.
- **`EditorialHeaderBase.tsx:180`** — Sign In at `8px 17px` / 13 px is ~34 px tall, under the
  44 pt hit target the banner comment cites. Pre-existing (was 36 px), not a regression.
- **`EditorialHeaderBase`** — `showDateline` prop and markup survive unused; author defers to
  Phase 5. Fine.

---

## Verified fine (what I checked and found sound)

**Area 1 — CookieConsentBanner.** Self-detection is impossible: the banner is a sibling of
`#page-content` (`layout.tsx:108-112`) and the selector is scoped to it. Client navigation in
both directions is handled: any route change mutates `document.body`'s subtree, the observer
fires, the rAF batch re-runs `detectSurface()`; React bails out on an unchanged value.
`EdLanguageSelector`'s `.dt-editorial` popover is portaled to `document.body`
(`EdLanguageSelector.tsx:227`) so it is correctly outside the scope. No app route renders
`.dt-editorial` under `#page-content` (grep). What the inner wrapper inherits from
`.dt-editorial`: `position: relative` (harmless inside the fixed outer), `color`,
`font-family: var(--dt-body)` (defined on `:root`, `globals.css:19`), `color-scheme`,
`font-synthesis: none`, the `::before` grain (absolute, `inset:0`, `z-index:0`,
`pointer-events:none`, clipped by the outer `overflow-hidden`+radius — reads as intended paper
texture) and `> * { position:relative; z-index:1 }` (lifts the row above the grain). The
inline `background: var(--ed-surface)` beats the class `background: var(--ed-paper)`; the
`!important` counter-rule does not match because the wrapper is not a child of
`.dt-stitch-root`. `var(--ed-r-3, 16px)` on the OUTER div resolves to the fallback (outer is
outside `.dt-editorial`) — correct by design. Dark tokens reach it via `.dark` on `<html>`.
**App branch is byte-identical** to the old return (diff shows only the inserted editorial
block). Both branches keep `motion-reduce:animate-none`. `slideUp` keyframe still in
`globals.css:220`.

**Area 2 — EdPageHero.** Default branch byte-identical (Python compare). Product variant
renders `eyebrow → h1 → lede → CTA row → product`; one `ed-cta` max.

**Area 3 — Pricing.** JSON-LD divergence is machine-tested: `tests/marketing-jsonld.test.cjs:317,
353,376` render the real `PricingPageContent` in all 11 locales and assert
`Article.description === EdPageHero.lede` and `SoftwareApplication.description === lede`;
both `PricingJsonLd` and the content call `tOr('pricing.heroLine', <same fallback>)` via
`getServerT(locale)`, so no locale/route can diverge without failing the suite (which passes).
`<meta description>` is genuinely unchanged: `app/pricing/page.tsx:8-9` is a literal string
and `app/[locale]/pricing/page.tsx:10` still uses `descKey: 'pricing.description'`. `Link`
import still used (line 370). No FAQPage emitted (test asserts).

**Area 4 — editorial.css.** Counter-rule pair intact (above). `.ed-cta` (0,2,0) vs Tailwind
(0,1,0): editorial always wins, and the file is imported after `globals.css`; pricing passes
its overrides inline (`style=`), which is the right escape hatch. `.ed-cta-quiet` uses `11px
23px` + 1 px border to match `.ed-cta`'s `12px 24px` geometry. `.ed-inline` is `a.ed-inline`;
the pricing `tryDemo` renders through `next/link` → `<a>`, so it matches. Token audit
(script): 35 light / 24 dark declarations; the 11 light-only tokens are all theme-neutral
(`--ed-r-*`, `--ed-dur-*`, `--ed-ease`, `--ed-glass-blur`, `--ed-radius`); **zero `--ed-*`
referenced anywhere in `src/` that is undeclared**; no dark-only token. `color-scheme` is the
explicit pair, not `light dark` (execution note #2 is right — next-themes writes the concrete
scheme). `--pg-*` paper island: fixed dark ink (`#20211e`/`#4a4943`) on `#ffffff` light /
`#e8e4dc` dark — legible in both, and the badge's hardcoded ambers sit on that island only.
`*:focus-visible` terracotta ring survives (line 632). `.ed-glass` has exactly two consumers
(`EditorialHeaderBase.tsx:63`, `EdLanguageSelector.tsx:129`) with the reduced-transparency
and print fallbacks intact; `.ed-glass--cta` exists only in a comment. Grain `::before` gets a
dark matrix; ambient `::after` is gone.

**Area 5 — ProductFrame.** All six text fragments verbatim (pdftotext). The answer paraphrases
only the cited sentence. `figure > [aria-hidden] + p.sr-only + figcaption` is valid (figcaption
last child). `dir="ltr" lang="en"` on the page is right — an English PDF does not reflow in an
Arabic UI — and the logical properties (`margin-inline-*`, `border-inline-end`) mirror the
chat column correctly. `landing.frame.*` is under the `landing.` prefix in
`app/[locale]/page.tsx:13`, so locale first paint is translated.

**Area 6 — ScrollReveal removal.** Old `ScrollReveal` rendered a single `<div>`; every site
replaces it with `<div>`, so the DOM shape is identical. React keys preserved (`key={idx}`,
`key={titleKey}`, `key={titleKey}` fragment). `id="how-it-works"` and `id="features"` survive
(`HomeJsonLd` HowTo step URLs depend on the former). `FinalCTA` h2 `ed-display → ed-h2` is
deliberate (display-1 is landing h1 only). Removing the `opacity-0`-until-intersect wrapper
also means SSR HTML is no longer hidden at first paint — a small LCP win.

**Area 7 — i18n.** See ledger above. Key counts +6 in every locale; zero nested objects.

**Area 8 — Deletions.** Only comment references remain (`[locale]/page.tsx:11`,
`TiltCard.tsx:17`, two in `editorial.css`). `package.json` drops `@remotion/player` and
`remotion`; lockfile clean.

**Landing structured data.** `HomeJsonLd.tsx` reads `landing.description`, `FAQ_ITEMS` and
`HOW_IT_WORKS_STEPS` only — none of the removed eyebrow/stat strings; `SocialProof` never fed
a schema block. `landingSchemaSources.ts` is unchanged. HeroSection keeps both
`landing_cta_clicked` events and both title/description keys.

**One filled action per view.** Landing: hero `ed-cta` + FinalCTA `ed-cta` (separate views);
masthead Sign In is now `ed-cta-quiet`. Pricing: only the Plus card is `ed-cta`. Shared page:
one. `EdCtaBanner`: one. Holds.

---

## Verdict

**SHIP-WITH-FIXES.** No blocker. Two majors, both one-line fixes: delete or scope the
unscoped reduced-motion rule (`editorial.css:652-659`) and change `#ffffff` →
`var(--ed-paper)` on `app/shared/[token]/page.tsx:99,103`. Then the parent's claim sheet
should be corrected: the `pricing_hero` `upgrade_click` was removed (plan-sanctioned, but the
"every event preserved" statement is false), and `.claude/rules/frontend.md` still says
"light-only".

---

## Author's note — fixes landed after this review (added 2026-09-21)
`phase1.diff` and the line numbers above describe the tree at `aba8208`, **before** these fixes.
Each finding was re-verified by the author against the code before being fixed.

| Finding | Commit | Result |
|---|---|---|
| MAJOR-1 unscoped reduced-motion | `f93ae39` | scoped to `.dt-editorial`, `animation-iteration-count: 1` added |
| MAJOR-2 `/shared` bubble in dark | `10f59bc` | `#ffffff` → `var(--ed-paper)`: 1.21:1 → 14.91:1 dark |
| MINOR-2 h1→h3 skip on /pricing | `662f7aa` | plan names `h2`, visual class unchanged |
| MINOR-9 olive chip in dark | `662f7aa` | 2.06:1 → 8.77:1 |
| MINOR-7 rule text not rewritten | `7a4698c` | `.claude/rules/frontend.md` lines 19–20 rewritten |
| MINOR-1, 3, 4, 5, 6, 8 | — | accepted with reasons; see the plan's "Phase 1 adversarial review — outcome" |

Post-fix checks by the author: 161/161 unit tests; `npm run build` green; contrast gate PASS; all 120
`editorial.css` selectors scoped to `.dt-editorial`; Phase 1 touches no golden-path file; on `/d/<id>`
the consent banner renders the app variant at the top; `/`, `/demo`, `/features`,
`/use-cases/lawyers`, `/trust`, `/tools` probed in light and dark — zero low-contrast text, no overflow.
MINOR-6 correction: the rendered count on `/` is **30** sub-12px text nodes (7–10px), all inside
FeatureGrid's aria-hidden decorative graphics — larger than the 13 source sites counted above.
