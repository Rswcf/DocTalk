# DocTalk — Apple design direction, Option A (structure adopted, identity kept)

**Date:** 2026-09-20
**Status:** Plan for owner approval. No code has been written.
**Owner decision already taken:** Option A — adopt Apple's compositional grammar (one dominant action per view, product UI as the hero, huge tight-tracked headlines, generous negative space, a real controls-vs-content material split, system-following dark mode) while keeping warm paper + terracotta as DocTalk's brand.
**Independent verification pass (2026-09-20, by the coordinating agent, after the plan was written):**
- **All 13 proposed contrast ratios re-computed from the hexes and confirmed to the second decimal** (`scratchpad/check_palette.py`): new terracotta `#843c28` 6.45 on paper / 7.90 white-on; dark accent `#e0957a` 7.53 on `#171614`, 6.85 on `#211f1c`; `--ink-2` `#4a4943` 7.38; `--ink-3` `#5f5e56` 5.32; olive `#35592c` 6.55; signal-hover `#6d3120` 8.13; dark ink `#ece9e2` 14.91; reader evidence `#7a4b00` 6.57; workbench-muted `#57606c` 5.72 light / `#c2c5cf` 10.87 dark; `.pdf-evidence-number` `#6b4400` 7.82. Zero pairs below 4.5. No colour claim in §5.3 or Phase 0 is estimated.
- **Dead-code claim confirmed and extended:** `ProductShowcase.tsx` is 621 lines as stated; the reachable cluster is 826 lines total (`+ ShowcasePlayer.tsx` 67, `ShowcasePlayerInner.tsx` 28, `showcaseData.ts` 110), entry point `ShowcasePlayer` is imported by nothing, and `remotion` + `@remotion/player` are both still in `package.json`.
- **`<title>`/`<meta>` coupling confirmed:** `app/[locale]/pricing/page.tsx:9-10` is literally `titleKey: 'pricing.headline'`, `descKey: 'pricing.description'`. Risk §9 #2 is real as written.
- **Two claims were FALSE and have been corrected in place**, both of which *shrank* Phase 1:
  1. `PricingTable` does **not** render inside the editorial `/pricing` page (§2.2 correction) — it is imported only by `app/billing/BillingPageClient.tsx:18`. `/pricing` is pure editorial kit with zero zinc/blue utilities. That component moved to Phase 3.
  2. `/demo`'s sample cards are **not** below the fold at 1512×793 (Phase 1 correction). Measured today: card titles at y=642, suggested questions at y=756, fold at 793 — all visible. The claim was recalled from an August memory. `/demo` is dropped from Phase 1; Jev independently scores it the second-healthiest page on the site.
- **Caveat on "no copy changes":** Phase 1 *removes* copy (the stat band, "STUDIO Nº 01", "Fig. 01" captions) and *restyles* `.ed-label` from mono caps to sentence case, but **rewrites no string**, so no locale file needs retranslation. If any retired element turns out to be a live i18n key, the key is simply left unused (unused keys do not break `next build`). The one new string, `pricing.heroLine`, ships via `tOr()` with an English fallback.

**Primary source:** Apple HIG extracts fetched 2026-09-20 (`scratchpad/hig/01-foundations.md`). The Layout page carries "September 9, 2026 — Updated guidance"; Liquid Glass is current HIG. Nothing below rests on remembered HIG text.

---

## 0. Decision record in one screen

| Question | Answer in this plan |
|---|---|
| What is actually wrong | Pages are ordered like essays (37/40 marketing routes lead with prose; `/pricing` shows its first price after **2.31 phone screens**), four visual systems coexist (three inside the app alone), five token pairs fail the 4.5:1 floor including the **citation marker**, and Liquid Glass sits in the content layer on 5 of its 7 consumers. Typeface count (4) and the magazine register are real but secondary. |
| Is the landing page the problem | No. It is the structurally healthiest page they own (Jev headline grammar 2.8/4, defect 0.28). The owner is reacting to what the landing *lacks* (a product moment), to the magazine register, and to the cliff into a cool-blue app after sign-in — not to its copy structure. |
| Identity | Kept: paper `#eae8e3`, ink `#20211e`, terracotta hue H13, olive for verified, Fraunces display voice. Changed: terracotta darkens from L42 to L34 (`#a04b34` → `#843c28`) to clear contrast; a warm dark stage is added; 3px "print" buttons become pills; mono eyebrows, numbered labels and the italic `<em>` split are retired. |
| One system or two | **Recommendation A2: one paper system across marketing and app**, executed in Phases 3–4 (the reader already sits on warm cream). Owner must confirm — see Open Question 1. |
| Typeface | **Two families with a hard role split**: Fraunces for marketing h1/h2 only, IBM Plex Sans for every other glyph on both surfaces. Sora and IBM Plex Mono retired. This deviates from "one family" as worded in A; Open Question 2 offers the one-family alternative. |
| Liquid Glass Batch 1 / Batch 2 | Content-layer glass (5 consumers) is **retired** in Phase 1 — sunk cost. Batch 2 as scoped (glass on app cards/panels) is **retired**. Functional-layer glass (headers, PDF toolbar, composer, menus) is re-aimed into Phases 3–4 under the HIG rule, reusing `.ed-glass`'s fallback discipline. |
| Phase 1 | Tokens (all 46 marketing routes, light + dark) + a restructured hero/kit variant + **two** funnel pages: `/pricing` and `/`. Copy is *removed* (stat band, datelines, `Fig. 01` captions, mono eyebrow styling), none is *rewritten*; one new key is added via `tOr()`. Judged on those two pages in two modes and four locales. (`/demo` was dropped during verification — see the Phase 1 correction.) |
| CLAUDE.md lock (2026-05-20) | **Partially vindicated**: the identity survives; the structure, materials and light-only rules do not. Exact replacement text in §8. |

---

## 1. Evidence base and its limits

What this plan rests on, in order of rigour:

1. **Measured (arithmetic, no model):** WCAG contrast of every declared token pair (`contrast-audit.txt`); `/pricing` fold geometry on a 375×812 viewport measured in-page (first price at y=1877 in a 5778px document); grep counts for typeface switches (26 on the marketing surface), `.ed-glass` consumers (7; 5 in content), routes (91; 46 on `MarketingShell`), sub-12px text sites (72), radii in use (6 scales), locale key counts (3,896 per locale, 84 `landing.*`).
2. **Judged by Jev on extracted production HTML (text structure only):** 40 English marketing routes, four identical questions each. Jev never saw colour, type or pixels. Headline grammar mean 0.76/4; 37/40 prose-before-product; 7 with competing top actions.
3. **Observed directly by a viewing agent:** landing, `/pricing`, `/demo`, authenticated dashboard, document reader, and apple.com/macbook-pro as reference (`visual-observations.md`). This is the only evidence for the authenticated surfaces.
4. **Code reading:** `globals.css` (740 lines), `editorial.css` (417), the marketing kit, landing, Chat, dashboard, reader, `layout.tsx`, `tailwind.config.ts`, i18n, sitemap, the Liquid Glass spec and both Codex rounds, and the git history of the design decisions.

**Rigour asymmetry, stated plainly.** The marketing surface has a quantified, repeatable audit. The dashboard and reader were assessed by one person looking at them once. Phase 3 therefore starts by closing that gap (§7, Phase 3 gate) before any app-surface styling is judged: a Playwright run with a test-account storage state that feeds the same `extract_fold.py` + Jev questions to `/` (authenticated) and `/d/{demo-id}`, plus a computed-style census per viewport (distinct font families, text nodes below 13px, distinct border radii, distinct surface colours, distinct toolbar idioms). Real funnel data (admin analytics, `citation_clicked` = 60 clicks / 7 real users) beats Jev's `acquisition_weight` wherever both exist.

---

## 2. Diagnosis, ranked

The ranking weights three things: measured severity, commercial weight, and whether the defect is systemic (comes from shared code) or local.

### 2.1 Pages are ordered like essays, not like product pages — systemic, from the kit
- 37 of 40 routes lead with explanatory prose before any demonstration or invitation (median prose-first 0.67). This comes from `EdPageHero` (eyebrow → h1 → lede → `meta`) followed by `EdSection` + `EdProse`, not from per-page authoring — `compare/chatpdf/ChatpdfContent.tsx` is 218 lines of which nine `<EdProse>` blocks precede the CTA banner.
- `/pricing` on a 375×812 phone: header, breadcrumb, mono eyebrow, a 3-line serif h1 (110px tall), an eight-line paragraph, two CTAs of near-equal weight ("Choose Plus" solid, "Try the public demo →" underlined), a bordered refund notice — and the first price at y=1877, 2.31 screens down. Jev: headline grammar 1.1/4, competing actions 0.89, prose-first 0.67, commercial weight 4.0/4 — the highest on the site.
- Hypothesis, not proof: admin analytics show 24 arrivals at `/billing` since May with zero recorded upgrade clicks and a payment button that has never been pressed. A pricing page that buries its prices under two screens of prose on mobile is a plausible contributing mechanism.
- Headline grammar averages 0.76/4; every `/compare/*` and `/alternatives/*` h1 is a title ("DocTalk vs ChatPDF: Full Comparison (2026)"), not a claim. The five hub pages (`/alternatives`, `/compare`, `/features`, `/tools`, `/use-cases`) are link farms with no dominant next step (competing 0.56–0.86).
- **Verdict: "not good", not "not Apple-like".** Apple's grammar (product first, one claim, one action) happens to be the direct cure, which is why the owner's instinct is right even though the landing hero is not where the defect lives.

### 2.2 Four live visual systems, three of them inside the app — systemic
`current-state.md` measured what CLAUDE.md describes as "TWO surface treatments":
1. `.dt-editorial` — paper/terracotta, Fraunces + Plex Mono, light-only (46 routes).
2. `--workbench-*` — cool blue-grey canvas `#f6f8fc`/`#eef3fb`, cyan glow tokens; 76 references in 11 components including `AppHeaderShell`, `PublicHeader`, `DashboardPageClient`, `ThemeSelector`, `LanguageSelector`.
3. `--reader-*` — warm cream `#f4f1ea`, evidence gold; consumed by `DocumentReaderPageClient`, six Chat components, `PdfToolbar`, `PdfViewer`, five Quotes components, Extraction, LayoutTranslation.
4. Base zinc + blue `#1D4ED8` — about/contact/imprint/privacy/terms/blog, billing, profile, auth, and every Tailwind `zinc-*`/`blue-*` utility in the reader's controls.
Plus a fifth, abandoned direction still in `tailwind.config.ts:19-21` (`serif` aliased to Sora "because the Stitch direction is rounded sans display type").

The golden path crosses them: `/` (1) → `/demo` (1) → `/d/[id]` renders 2 + 3 + 4 at once (blue-grey header over cream chat column over zinc controls; PDF toolbar in a fourth idiom). `PricingTable.tsx` renders zinc/blue (`bg-blue-50` ×6, `bg-zinc-900` buttons) on the authenticated `/billing` page, which a `/pricing` CTA sends the user straight to — so the purchase path crosses the seam at the moment of payment. *(Correction applied 2026-09-20 during verification: an earlier draft of this plan said `PricingTable` renders inside the editorial `/pricing` page. It does not. `PricingTable` is imported only by `app/billing/BillingPageClient.tsx:18`; `/pricing` renders its own plan cards from the editorial kit — `EdCardGrid`, `ed-label`, `ed-h3`, `ed-num`, `EdCheckList`, `var(--ed-signal)` — with **zero** zinc/blue utilities. The seam is real but it is on `/billing`, not `/pricing`.)* `HomePageClient` shows the paper landing during `status === 'loading'`, then swaps to the cool dashboard: authenticated users see the seam on every cold load.

**Verdict: "not good".** This is the fragmentation the brief asked whether the evidence supports. It does. It is also what makes "product UI as the hero" impossible today: a screenshot of a cool-blue app cannot sit on warm paper without looking pasted on. Option A only fully cures this if the app also moves to paper (A2, §5.0).

### 2.3 Five token pairs fail the HIG 4.5:1 floor; the citation marker is one of them
| Pair | Role | Ratio |
|---|---|---|
| `--ed-ink-3` `#8a897f` on `--ed-paper` `#eae8e3` | eyebrow / small label — the editorial signature element | **2.87** |
| `--reader-evidence` `#b7791f` on `--reader-bg` `#f4f1ea` | **citation marker** | **3.23** |
| `--reader-evidence` on `--reader-evidence-soft` `#fff4d6` | highlighted citation state | **3.32** |
| `--workbench-muted` `#64748b` on `#eef3fb` | app secondary labels | 4.27 |
| `--workbench-muted` on dark canvas `#111214` | same, dark | 3.94 |

Verbatim, page-accurate citation is the product's entire value proposition (`backend.md` "Verified Quote Pipeline"), and the colour that marks it is the second-worst pair in the system. Eight more pairs pass 4.5 but sit under the 7:1 the HIG asks for in small text — including editorial body at 5.66 and **terracotta links at 4.83, barely above the floor**. Keeping the identity therefore cannot mean keeping the hex (§5.3). **Verdict: "not good"; fixable in Phase 0 with token edits.**

### 2.4 Liquid Glass is in the content layer on 5 of 7 consumers
HIG Materials: "Don't use Liquid Glass in the content layer… use standard materials for elements in the content layer" and "Use Liquid Glass effects sparingly… Limit these effects to the most important functional elements." `.ed-glass` consumers: `EditorialHeaderBase` (sticky header ✓), `EdLanguageSelector` (popover ✓) — and `HeroCollage` ×3, `EdCardGrid` ×2 (19 pages), `EdFaqList` (24 pages), `EdCtaBanner`, `EdComparisonTable` (9 pages), all content. The viewing agent recorded that at real scale these cards "do not read as glass — they look like flat cards on paper." The material pays a `backdrop-filter` repaint on every content card for an effect that is both barely visible and in the layer the HIG excludes. **Verdict: "not Apple-like" by the primary source's own words, and "not good" (cost without effect).**

### 2.5 Typography: four families, 26 switches, a Latin-only identity, and sub-12px text
- `layout.tsx` loads IBM Plex Sans, Sora (wordmark), Fraunces, IBM Plex Mono. HIG: "Minimize the number of typefaces… Mixing too many different typefaces can obscure your information hierarchy." 11 `font-family` declarations in `editorial.css` (line 187 hardcodes `var(--font-plex-sans)`, bypassing the token) plus 15 inline `var(--dt-serif)`/`var(--dt-mono)` switches across 8 of 36 marketing/landing files.
- The mixed-voice headline (`.ed-display em` → Fraunces italic) is Latin-only: under `html:lang(zh|ja|ko|ar|hi)` `--dt-serif` resolves to the sans system stack (`globals.css:17-45`), so the serif identity does not exist in 5 of 11 locales — and worse, `font-style: italic` on a CJK/Arabic/Devanagari glyph with no italic face produces a browser-synthesized oblique. Five locales ship a faux-italic hero line today.
- 72 sites of `text-[9px|10px|11px]` on the app surface; the chat disclaimer is `text-xs` (12px) on `zinc-400`; the reader answer is `prose-sm` (14px) beside PDF page text that renders larger. HIG minimums are 11pt (iOS) / 10pt (macOS) at device scale; 9–10px CSS on a desktop is below both.
- Mono ALL-CAPS eyebrows with `01 —` numbering appear on content that is not a sequence (feature grids, section labels, "STUDIO Nº 01"). The landing stat band shows "01 CITED ANSWERS", which reads as a broken counter.
- Craft note that cuts the other way: the Fraunces h1 on `/pricing` at 375px is genuinely well set. The typeface is not the failure; its *deployment* (four families, switches, italic split, mono labels) is. **Verdict: mixed — the family count and switches are "not Apple-like" by HIG text; the faux-italic and sub-12px text are "not good".**

### 2.6 No product moment anywhere on the marketing surface
The landing hero's right half is `HeroCollage` — an art-directed illustration of documents. The real product showcase (`ProductShowcase.tsx`, 621 lines of Remotion, plus `ShowcasePlayer`, `HeroArtifact`) is **dead code**: nothing renders it (grep finds only a comment in `[locale]/page.tsx` and a comment in `TiltCard`). `remotion` + `@remotion/player` remain in `package.json`. Apple's grammar puts the product in the majority of the viewport; DocTalk's puts a drawing of it in 5 of 12 columns. **Verdict: "not Apple-like" and the single most visible thing the owner is missing on the landing.**

### 2.7 Marketing is light-only; 46 of 91 routes ignore the system preference
`ThemeProvider` is `defaultTheme="system"` (HIG-compliant) but `.dt-editorial` declares itself light-only. HIG Color: "Even if your app ships in a single appearance mode, provide both light and dark colors." **Verdict: "not Apple-like"; §5.3 resolves it.**

### 2.8 Motion is generic rather than purposeful
`ScrollReveal` fades-and-rises every landing section (700ms, per section); five `.dt-*` rules lift on hover (`translateY(-1px)`); the ambient `::after` and paper-grain `::before` exist to give glass something to blur. HIG Motion: "Don't add motion for the sake of adding motion… generally avoid adding motion to UI interactions that occur frequently." `prefers-reduced-motion` is handled in `spell/*`, `TextViewer` and one `globals.css` rule; `ScrollReveal` uses `motion-reduce:transition-none` (fine). **Verdict: "not Apple-like"; low cost to fix.**

### 2.9 What is fine and should be left alone
- `defaultTheme="system"` — keep. On the theme *toggle* (`ThemeSelector.tsx`), HIG Dark Mode says "avoid offering an app-specific appearance setting": the marketing header gets **no** toggle (it follows the system, full stop); the app keeps its selector through Phase 3 because users may already depend on it, and Phase 3 retires it to a Profile setting rather than header chrome. *(Execution note added during verification: do not over-read the HIG line here. What it warns against is an app-specific appearance setting that competes with the system preference. A control that **defaults to system** and merely lets a user override is ordinary Apple behaviour — Books and Notes both ship one. Since `ThemeProvider` is already `defaultTheme="system" enableSystem`, moving the selector out of header chrome is a chrome-decluttering decision, not a compliance requirement. Removing the override entirely is **not** sanctioned by this plan.)*
- Per-script `:lang()` system stacks — keep (they are exactly what Apple does with PingFang / Hiragino / SF Arabic).
- `<html dir>` is set from `locales-meta.ts` for `ar` (`LocaleProvider.tsx:108`) — RTL is handled at the document level. Only 5 logical-property utilities (`ms-`/`me-`) vs 0 physical ones were found in JSX, which is good.
- The de-glass leftover bug class is down to 4 sites — not worth a phase.
- The `!important` counter-rule pair (`globals.css:728-735` / `editorial.css:52-55`) — under Option A `.dt-editorial` survives, so this pair is **not touched** in any phase.

### 2.10 The landing-page tension, addressed directly
The owner asked "especially the landing page". The data says the landing is the best-structured page on the site and the 38 kit pages behind it are where the surface falls apart. Both are true. What the owner is most likely reacting to on `/` is: (a) there is no product on it, only a drawing; (b) the register — mono datelines, "Fig. 01", numbered eyebrows, hairline stat band — says "magazine", and the owner wants "precision software"; (c) the inconsistent button geometry (3px CTA vs pill Sign In); (d) the cliff into a different, cooler product after signing in. Phase 1 fixes (a), (b), (c) on `/` and starts on (d); the rest of the marketing surface gets the structural cure through the shared kit.

---

## 3. Gap analysis — HIG foundation × surface

Severity: **S1** blocks the HIG rule outright and is user-visible; **S2** contradicts the rule with limited visibility; **S3** cosmetic / consistency.

| HIG foundation | Marketing (46 routes) | Dashboard (`/` authed, collections, billing, profile) | Reader (`/d/[id]`) | Auxiliary (about, contact, legal, blog, auth, admin, shared) |
|---|---|---|---|---|
| **Typography** — minimize typefaces; hierarchy by weight/size/colour; avoid light weights; tight leading only for ≤2 lines | 3 families in play (Fraunces / Plex Sans / Plex Mono) + Sora wordmark; 26 switch sites; italic `<em>` split is Latin-only and synthesizes italic in zh/ja/ko/ar/hi; mono ALL-CAPS eyebrows; `.ed-label` 11px, `.ed-caption` 10.5px. **S1** | Plex Sans + Sora (`font-logo`) + `font-mono` chips; `text-[10px]` meta, "BETA" chip 10px; native `<select>` in OS font. **S2** | Plex Sans; answer body `prose-sm` 14px beside larger PDF text; superscript cite chips 10px; disclaimer 12px `zinc-400`; three toolbars in three type idioms. **S1** | Plex Sans on zinc; blog uses `prose`; auth minimal. **S3** |
| **Layout** — most important content top-leading; differentiate controls from content; progressive disclosure; adapt to RTL/text size | Essay order on 37/40 routes; `/pricing` first price at 2.31 screens; hubs with no dominant action; 1200px shell with 88px sections reads dense. RTL: `dir` set at document level ✓. **S1** | Privacy strip (four claims, small type) precedes the upload zone; two URL/upload actions + "Try demo" + workspace promo compete; controls and content share one white plane. **S1** | Two-pane split is right; but header, chat column and PDF pane each own a toolbar in a different idiom; no single visual owner. **S2** | Fine structurally; blog index is a card kit. **S3** |
| **Colour** — consistent meaning; light + dark for every custom colour; never colour alone; culture check | Terracotta = action AND links AND decorative; slate = links AND "set-dressing"; olive = verified ✓. No dark set. Eyebrow 2.87:1, links 4.83:1, body 5.66:1. **S1** | Blue = action, focus, links, promo, and canvas tint (`--workbench-glow-cyan`); `workbench-muted` 4.27 / 3.94 dark. **S1** | Blue accent + gold evidence + cream ground + zinc controls; **citation marker 3.23 / 3.32** — the product's core signal fails. **S1** | Zinc + blue; passes (6.70). **S3** |
| **Materials** — Liquid Glass only for the functional layer, sparingly; standard (opaque) materials for content | Glass on 5 content consumers (hero plates, card grids, FAQ, CTA banner, comparison table); ambient + grain layers exist to serve it; header/popover glass is legitimate. **S1** | Solid surfaces (de-glassed 2026-05) — HIG-compliant by accident; header is opaque `#ffffff`, no scroll-edge effect. **S3** | Solid; PDF toolbar opaque; `backdrop-blur` utilities remain in `PdfToolbar`, `QuoteFinderPanel`, `TextViewer`, `ThemeSelector`, `LanguageSelector` (12 sites) without reduced-transparency fallbacks. **S2** | `AdminPageClient`, `BillingPageClient`, `CookieConsentBanner` use `backdrop-blur` on content/overlays. **S3** |
| **Motion** — purposeful, brief, optional, not on frequent interactions | `ScrollReveal` on every section (700ms); card hover lift; `ShimmerBadge` on "Most popular". **S2** | Hover lifts on `.dt-workbench-button`, `.dt-suggested-question`; `animate-pulse` status dot. **S3** | `.dt-source-chip`/`.dt-citation-card` hover lift on frequently-used controls; evidence arrive animation is purposeful ✓ and respects reduced motion ✓. **S2** | Cookie banner `slideUp` keyframe has no reduced-motion guard. **S3** |
| **Dark mode** — respond to system; not a mechanical inversion; 4.5:1 floor, strive for 7:1 | **Light-only by declaration** — 46 routes ignore the preference. **S1** | Dark set exists; `workbench-muted` fails (3.94). **S2** | Dark reader set exists (`--reader-bg #151410` is already a *warm* dark — precedent for §5.3); evidence `#f1b84b` passes. **S3** | Zinc dark set passes. **S3** |
| **Accessibility / contrast** — 4.5:1 floor, 7:1 for small text; test Increase Contrast + Reduce Transparency | Eyebrow 2.87 (fail); 5 small-text pairs under 7; focus ring in terracotta ✓; reduced-transparency fallback on `.ed-glass` ✓. **S1** | Muted 4.27 (fail); `text-[10px]` ×18, `[11px]` ×50, `[9px]` ×4 across app; native select unstyled. **S1** | Citation marker 3.23/3.32 (fail); 14px answer body; 12px disclaimer on `zinc-400` (4.83 on white, lower on cream). **S1** | Passes. **S3** |

---

## 4. The fork — recorded for auditability

The owner has chosen A. This section exists so the decision can be audited later, not to reopen it.

**Option A — Apple structure, DocTalk identity kept.** Buys: the whole structural cure (§2.1), the material and motion cures (§2.4, §2.8), dark mode, contrast, and a product moment, without a rebrand; the reader is already warm, so an all-paper app is a shorter walk than it looks; three prior rounds have already invested in the paper identity and the owner has just re-affirmed it. Costs: terracotta must darken (L42 → L34) and the eyebrow colour must darken, so the brand's *appearance* changes even though the identity is kept; a warm dark stage must be designed rather than inverted; the serif voice remains Latin-only (5 locales get sans headlines — which is also what Apple ships in CJK); the app-side unification (76 workbench references, zinc utilities in billing/profile/auth) is the same work under either option. Forecloses: a neutral near-white/near-black stage; using the app's blue as the brand accent.

**Option B — full Apple-neutral rebrand.** Would have bought one system with Apple's own material (neutral stages, blue accent) and the cleanest possible product-as-hero; costs the editorial identity, Fraunces, the Counterpoint palette and the entire `editorial.css`, and it is the most default of all SaaS looks unless the product moment carries the identity alone. Forecloses the warm identity for good.

**The 2026-05-20 lock is partially vindicated, not overridden.** The May test that produced "the warm-paper terracotta identity is load-bearing" was a test of *blue on warm paper* (commit `146249c`: "the blue accent on warm paper didn't read right"). It never tested a neutral stage, so it was not evidence against B — but the owner has now confirmed the identity by choice, which settles it. What the lock got wrong is the second half: "do not re-propose merging" was read as "do not touch the marketing/app seam", and the seam is defect #2. Under Option A the identity is kept and the *structure, materials, light-only rule and the seam* are replaced. §8 gives the exact rewrite.

**Why I recommended A2 (one paper system) rather than A1 (paper marketing, zinc app):** the golden path seam is ranked #2; the reader is already on warm cream (`--reader-*`), so only the dashboard/header/aux pages are genuinely cool today; and "product UI as the hero" is only honest if the hero frame shows the real reader on the stage it actually lives on. Under A1 the hero frame may show *only* the reader pane (cream + white page), never the cool header, and the dashboard must be unified onto zinc/blue instead of paper. Open Question 1 asks the owner to confirm A2.

---

## 5. Target system (Option A)

### 5.0 Identity boundary — what is kept, what moves
| Kept (brand) | Changed (structure / HIG) |
|---|---|
| Paper ground `#eae8e3`, ink `#20211e`, terracotta hue (H13), olive = verified, Fraunces as the display voice, hairline rules, the logo glyph | Terracotta lightness (L42 → L34); a warm dark stage; pill buttons replace 3px "print" buttons; mono ALL-CAPS eyebrows, `01 —` numbering, "STUDIO Nº 01" datelines, "Fig. 01" captions, the italic `<em>` split, the serif stat numerals, paper grain (kept, see 5.6) and ambient glow (retired); Sora wordmark → Plex Sans 600; Plex Mono → system mono, code only |

### 5.1 Typeface — Fraunces (display) + IBM Plex Sans (everything else)
**Deviation from A as worded ("one typeface family"), flagged for the owner (Open Question 2).** HIG's rule is "minimize"; the primary source itself pairs SF with New York, "designed to work alongside SF". The measured evidence says the Fraunces h1 is the one thing on `/pricing` that is well set. So: two families, each with exactly one job, and a hard ban on switching anywhere else.

- **Fraunces** (SIL OFL, Google Fonts, variable wght 100–900 + `opsz` 9–144 + `SOFT`; already loaded via `next/font/google` — no CSP change, `font-src 'self' data:` stays). Role: marketing `h1` and `h2` only (`.ed-display`, `.ed-h1`, `.ed-h2`). Never in the app, never below `h2`, never italic, never for numerals.
- **IBM Plex Sans** (SIL OFL, Google Fonts; loaded 400/500/600/700 — 700 is the family's true ceiling). Role: every other glyph on both surfaces, including the wordmark (600, −0.02em, replacing Sora).
- **Mono**: `ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace` — zero download; code blocks (Shiki) and `.pdf-evidence-number` only. IBM Plex Mono unloads in Phase 2 after the label sweep (unloading it in Phase 1 would drop 44 routes' eyebrows to `ui-monospace` mid-migration).
- **Presence without weight.** Display presence comes from size (80px), tight leading (1.02), negative tracking (−0.02em) and Fraunces at `opsz` 144 (its high-contrast display cut). Weight stays 600: Fraunces at 700+ turns "Cooper", not Apple, and Plex Sans cannot exceed 700 anyway. The variable Fraunces load already removes the 700 ceiling for the two display steps; nothing else needs more than 600.
- **Degradation for zh / ja / ko / ar / hi.** `--dt-serif` already resolves to the sans system stack under `:lang()` (`globals.css:17-45`) — keep. Consequences made explicit: the serif voice is Latin-only *by design* (Apple does the same: SF + PingFang); the display steps render in the body family at weight **600** (PingFang SC tops out at Semibold — 700 would be synthesized), tracking **0** (negative tracking collides CJK/Arabic glyphs), display leading **1.2** (CJK) / **1.3** (Arabic), body leading 1.7 / 1.8. Add `font-synthesis-weight: none; font-synthesis-style: none` on both surface roots so a missing face shows as a missing face during QA instead of a faux bold/italic. Removing the `<em>` split removes today's synthesized italic in five locales.

**Ramp (Latin).** Sizes in px, `clamp()` where fluid; tracking in em; leading unitless.

| Step | Family / weight | Size | Tracking | Leading | Use |
|---|---|---|---|---|---|
| display-1 | Fraunces 600, opsz 144, SOFT 0 | clamp(44, 6.5vw, 80) | −0.02 | 1.02 | landing h1 only; ≤ 2 lines, ≤ 22 chars/line at 80px |
| display-2 | Fraunces 600, opsz 144 | clamp(36, 4.8vw, 56) | −0.015 | 1.06 | inner-page h1 (`EdPageHero`) |
| title-1 | Fraunces 600, opsz 96 | clamp(28, 3.2vw, 40) | −0.01 | 1.12 | marketing h2 |
| title-2 | Plex Sans 600 | 22 | −0.01 | 1.25 | h3, card titles, app page titles |
| title-3 | Plex Sans 600 | 18 | 0 | 1.3 | h4, panel headers |
| headline | Plex Sans 500/600 | 15 / 17 | 0 | 1.4 | nav, buttons, table headers, chip labels |
| body-l | Plex Sans 400 | clamp(19, 1.6vw, 21) | 0 | 1.5 | lede; ≤ 60ch |
| body | Plex Sans 400 | 17 | 0 | 1.55 | marketing prose (≤ 68ch); **chat answers** (up from 14px `prose-sm`) |
| body-s | Plex Sans 400/500 | 15 | 0 | 1.5 | app UI default: lists, rows, table cells, inputs |
| caption | Plex Sans 400/500 | 13 | +0.005 | 1.4 | meta, timestamps, disclaimer — **the floor** |
| numeral | Plex Sans 600, `tabular-nums` | inherits step | 0 | 1 | prices, page numbers, credits; never Fraunces |

12px is permitted only for tabular numerals inside chips (page badges). Nothing renders below 12px; the 72 `text-[9|10|11px]` sites lift to 13 (or 12 tabular). `.ed-label` becomes sentence-case Plex Sans 15/600 `--ed-ink-2` (an Apple "MacBook Pro"-style product label), not mono caps.

### 5.2 Layout: spacing, widths, radius
- **Spacing scale (4px base):** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128. Marketing section rhythm 96 desktop / 64 mobile (was 88/56). Between hero and first section: 128.
- **Widths:** page shell **1024px** (was 1200) with 24px gutters (16 on phone); hero text column 720px; prose 640px (≤ 68ch at 17px); product frame may bleed to 1024.
- **Alignment:** ranged left throughout (keeps the editorial discipline; Apple's own product pages are centred, but centring 46 SEO pages of prose is wrong); the hero frame is the one element that may sit centred under a centred claim on `/`.
- **Radius scale (5 steps, replaces 6 competing scales):** `--r-1: 8px` inputs/chips · `--r-2: 12px` controls/menus · `--r-3: 16px` cards/panels · `--r-4: 24px` product frames/sheets · `--r-pill: 999px` buttons and segmented controls. Phase 3 remaps Tailwind `borderRadius` to exactly these (`sm`=8, `md`=12, `lg`=16, `xl`=24, `full`) and removes `2xl`/`3xl`/arbitrary `rounded-[…]`. The 3px `.ed-cta` becomes a pill.
- **One dominant action per view:** exactly one `--ed-signal` filled control above the fold; everything else is ink-outline or text. The secondary "Sign up free →" and "Try the public demo →" become text links in ink, not a second CTA.
- **Controls vs content (HIG Layout):** the sticky header is the only chrome on marketing pages and gets a scroll-edge hairline (`data-scrolled`) instead of a permanent border. In the app, the header, the PDF toolbar and the composer are chrome; everything else is content on the paper ground.

### 5.3 Colour — light (paper) and dark (warm near-black), with measured ratios
Rules first: terracotta = **action** (the one dominant CTA) and **links** (always underlined — never colour alone); olive = **verified/ready** only; amber = **evidence/citation** only; red = **error** only; slate is retired as a colour role (it was doing links *and* decoration). Accent-as-text is allowed only at **≥ 15px**; anything smaller uses ink. Hue never changes across modes — only lightness.

**Light (`.dt-editorial`, and the app under A2)**

| Token | Hex | On | Ratio | Notes |
|---|---|---|---|---|
| `--stage` (paper) | `#eae8e3` | — | — | kept |
| `--surface` (cards, product frame) | `#f6f5f2` | stage | 1.12 (non-text) | lighter than ground = raised (Apple light mode); replaces the darker inset `--ed-paper-2` for cards |
| `--surface-2` (document page inside frames) | `#ffffff` | stage | 1.22 | |
| `--inset` (alternate section band) | `#e5e3dc` | stage | 1.05 (non-text) | ex `--ed-paper-2` `#e4e2db`, lightened one step so body prose on `EdSection alt` bands clears 7:1 (at `#e2e0d9` it was 6.84) |
| `--hairline` | `rgba(32,33,30,.12)` | — | — | decorative rules; exempt |
| `--control-border` | `#86847b` | stage | **3.06** | inputs/toggles need a perceivable boundary (WCAG 1.4.11 ≥ 3:1) |
| `--ink` | `#20211e` | stage / surface | **13.22 / 14.84** | kept |
| `--ink-2` (body, secondary) | `#4a4943` | stage / surface / inset | **7.38 / 8.28 / 7.03** | was `#5b5a52` at 5.66; body prose on every `EdSection alt` band is the inset case |
| `--ink-3` (captions ≥ 13px only) | `#5f5e56` | stage / inset / surface | **5.32 / 5.08 / 5.98** | was `#8a897f` at 2.87; never for essential text |
| `--signal` (terracotta) | `#843c28` | stage / surface / white / inset | **6.45 / 7.25 / 7.90 / 6.15** | was `#a04b34` at 4.83; H13 unchanged, L42 → L34; olive on inset 6.25, evidence on inset 5.77 |
| white on `--signal` (CTA label) | `#ffffff` | signal | **7.90** | |
| `--signal-hover` | `#6d3120` | stage; white on it | **8.13; 9.95** | |
| `--olive` (verified) | `#35592c` | stage | **6.55** | was `#3f6a34` at 5.16 |
| `--evidence` (citation text/marker) | `#7a4b00` | stage / white page / soft | **6.05 / 7.41 / 6.53** | replaces `--reader-evidence #b7791f` (3.23) |
| `--evidence-soft` (highlight fill) | `#fff0c2` | — | ink on it 15.2 | on PDF pages use `rgba(255,204,0,.28)` over white ≈ `#fff1b8`, ink 14.85 |
| `--danger` | `#9a2119` | stage | **6.58** | H4, cooler than terracotta H13; always with icon + label |

**Dark (`.dark .dt-editorial`, and the app under A2)** — a warm near-black, not an inversion of paper and not zinc. Precedent already in the codebase: `--reader-bg #151410`.

| Token | Hex | On | Ratio | Notes |
|---|---|---|---|---|
| `--stage` | `#171614` | — | — | |
| `--surface` | `#211f1c` | stage | 1.10 (non-text) | raised |
| `--surface-2` | `#2a2825` | — | — | |
| `--inset` | `#1c1b18` | — | — | |
| `--hairline` | `rgba(236,233,226,.12)` | — | — | |
| `--control-border` | `#767268` | surface | **3.43** | |
| `--ink` | `#ece9e2` | stage / surface | **14.91 / 13.56** | warm off-white, not `#fafafa` |
| `--ink-2` | `#b8b4ab` | stage / surface / inset | **8.74 / 7.95 / 8.33** | |
| `--ink-3` | `#948f86` | stage / surface | **5.63 / 5.11** | captions ≥ 13px only |
| `--signal` (text, links) | `#e0957a` | stage / surface / surface-2 | **7.53 / 6.85 / 6.12** | H16, L68 — the same rust lifted, not a different hue |
| CTA in dark: fill `#e0957a`, label `#171614` | | fill | **7.53**; fill vs stage 7.53 | do **not** keep the `#843c28` fill in dark: it is only 2.29 against the stage |
| `--olive` | `#8fc27d` | surface | **7.97** | |
| `--evidence` | `#f0b323` | stage / surface / soft `#3a2e10` | **9.62 / 8.75 / 7.08** | the existing dark reader value `#f1b84b` is equivalent |
| `--danger` | `#ff7a6b` | surface | **6.46** | |

**How far the accent can move and still be the brand:** the hue is fixed at H13–16 across every value above. Lightness may sit between **L30 and L38** at S50–55 on paper (L34 chosen); below ~L28 it reads as oxblood/maroon, above ~L40 it fails the contrast floor. In dark mode the same hue lives at **L64–72** (L68 chosen). The brand is therefore the hue and its placement, not the exact hex — which is what the owner's "keep terracotta" decision buys.

### 5.4 Materials — the content/functional split
- **Content layer = standard materials:** opaque `--stage` / `--surface` / `--surface-2`, hairline borders, one raised-card shadow token `0 1px 2px rgba(20,18,14,.06), 0 12px 32px -16px rgba(20,18,14,.18)` (dark: alpha ×2). No `backdrop-filter`, no translucency. `.ed-glass` is removed from `HeroCollage` (retired), `EdCardGrid`, `EdFaqList`, `EdCtaBanner`, `EdComparisonTable`. The ambient `::after` is retired (it existed to feed content glass).
- **Functional layer = one glass recipe, both surfaces:** `.dt-glass { background: color-mix(in srgb, var(--surface) 78%, transparent); backdrop-filter: saturate(160%) blur(18px); border-bottom: 1px solid var(--hairline) }` — the regular variant only (HIG: use *regular* where the component holds text; *clear* is for media). Consumers, and only these: marketing sticky header, app header, PDF toolbar (sticky), chat composer shell, popovers/menus (theme, language, session, plus-menu), cookie banner. Every rule carries `prefers-reduced-transparency: reduce` → opaque `--surface` and `@media print` → opaque static, inherited from the `.ed-glass` discipline that shipped in v0.28.0 (the one part of Batch 1 that survives).
- **Perf red-lines (unchanged from the glass spec §1):** never on SSE-streaming answer cards, PDF page layers, Recharts panels or any frequently-reflowing list.
- **Scroll-edge effect:** headers are borderless at scroll 0 and gain the hairline once content scrolls beneath (`IntersectionObserver` sentinel → `data-scrolled`), replacing the permanent `border-b`.

### 5.5 Motion
- Durations: 120ms colour/opacity (hover, focus), 200ms open/close/enter, 320ms sheets and the single hero reveal. Easing `cubic-bezier(.2, .8, .2, 1)`. No hover translation on any control (delete the five `translateY(-1px)` rules in `globals.css`). 
- One orchestrated moment: the hero product frame on `/` fades and rises 320ms once on load. `ScrollReveal` is deleted from every section; sections are simply there. 
- Motion answers actions: citation jump (existing `evidenceArrive` 220ms ✓), menu open, sheet open, answer streaming. Nothing animates on frequent interactions (chips, rows).
- One global `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important } }` plus the existing component guards; the cookie banner `slideUp` gets covered by it.

### 5.6 Set-dressing decisions
- **Paper grain** (`.dt-editorial::before`): identity-compatible and cheap; kept at opacity .5 light / .35 dark with the colour matrix inverted for dark. **Ambient glow**: retired. **Halftone / crosshair / `§` glyph / "STUDIO Nº 01" / "Fig. 01"**: retired with `HeroCollage`.
- **Stat bands** ("11 / 6 / 01"): retired. Numbers appear only where they are facts in context (pricing, page counts).
- **Numbered `01 —` labels**: retired except on `EdStepRow` (an actual sequence) and `HowItWorks`.

---

## 6. What happens to the Liquid Glass work (v0.28.0 Batch 1, planned Batch 2)

Said in plain words, because the coordinator asked for it: **Batch 1's content-layer glass is retired in Phase 1 — sunk cost.** Five of its seven consumers put the material where current HIG says it must not go, the live site shows it does not even read as glass at real scale, and it charges a repaint for that. The two functional-layer consumers (sticky header, language popover) stay and become the seed of the shared `.dt-glass`. The Counterpoint palette migration, the Fraunces load, the `prefers-reduced-transparency`/print fallback discipline, the ambient-vs-`filter:blur` performance finding, and the two app-surface cascade traps documented in spec §5 (`.dt-*` after `@tailwind utilities`; `isolation: isolate` on `.dt-stitch-theme`/`.dt-shell-header` making headers backdrop roots that sample nothing) are all carried forward. **Batch 2 as scoped (cool glass on app cards, panels, composer, pills, restored app ambient) is retired.** Its legitimate residue — glass on the app header, PDF toolbar, composer and menus — lands in Phases 3–4 under the functional-layer rule with the cascade traps resolved first. Nobody needs to re-review the Batch 1 Codex rounds; their findings about `!important` counter-rules and hover specificity remain valid and are listed in §9.

---

## 7. Phased plan

Argued against the Jev priority ranking, not intuition. Each phase ships and is judged alone; each names its Codex gate.

### Phase 0 — Contrast hotfix (hours; ships independently; no design decision required)
- **Files:** `frontend/src/app/editorial.css` (`--ed-ink-3` → `#5f5e56`, `--ed-ink-2` → `#4a4943`, `--ed-signal` → `#843c28`, `--ed-signal-deep` → `#6d3120`, `--ed-olive` → `#35592c`); `frontend/src/app/globals.css` (`--reader-evidence` light → `#7a4b00` — **6.57** on the current `--reader-bg #f4f1ea`, **6.53** on the new soft; `--reader-evidence-soft` → `#fff0c2`; `--reader-evidence-border` → `#e6c56a`; `--workbench-muted` light → `#57606c` — **5.72** on `#eef3fb`, 5.99 on `#f6f8fc`; dark → `#c2c5cf` — **10.87** on `#111214`); `.pdf-evidence-number` colour `#70530d` → `#6b4400` — **7.82** on its `#fff4d6` fill. All measured, not estimated.
- **Blast radius:** every route, colour only, no layout, no copy, no i18n. Revert = one commit.
- **Judge:** re-run `contrast_audit.py`; zero pairs below 4.5.
- **Codex:** not required (token edits, no logic). Note it in the deploy log.

### Phase 1 — "Show, then tell": foundation + kit variant + the two funnel pages (1–2 weeks)
Why these two: `/pricing` is first by every measure (commercial weight 4.0, the 2.31-screen price, competing actions 0.89) — it is the proof page. And `/` is where the product moment must exist, is the second-heaviest page (3.5), and its hero frame is the same component `/pricing` needs above its plans. Two pages, one shared frame. The 44 other kit routes inherit the token, label and material changes automatically but keep their section order until Phase 2.

> **Correction applied 2026-09-20 during verification — `/demo` is dropped from Phase 1.** The draft included `/demo` on the grounds that "its sample cards sit below the fold at 1512×793 (memory, 2026-08-25)". That is a recalled fact, and it is **no longer true**. Measured in-page today at 1512×793: the card row starts at y=525, all three card titles sit at **y=642**, and even the suggested questions at y=756 — every one of them above the 793 fold. Jev independently scores `/demo` prose-first **0.10** and competing-actions **0.11**, the best pair on the site; its total defect 0.34 is second-best after `/`. `/demo` is already structurally healthy and does not need Phase 1. Its one weak number is headline grammar 1.5/4 ("Choose a sample document"), which is a clear instruction rather than a defect. It inherits the Phase 1 tokens like the other kit routes and is revisited in Phase 2. This removes a whole page from Phase 1.

Three layers, deliberately separable:
1. **Tokens (global, mechanical, revertible):** `editorial.css` — the §5.3 light set, a `.dark .dt-editorial` set, `color-scheme: light dark` on the root, `.ed-label`/`.ed-caption`/`.ed-crumb` redefined as sentence-case Plex Sans (13–15px), `.ed-display`/`.ed-h1`/`.ed-h2` on the §5.1 ramp with the `em` rule deleted, `.ed-cta` as a pill, `.ed-glass` removed from the five content consumers, `::after` ambient removed, grain given a dark matrix, `font-synthesis-*: none`, the §5.5 reduced-motion rule. `layout.tsx`: `theme-color` metas become `#eae8e3` / `#171614` for marketing (or move to the shells). **Not** in Phase 1: unloading Sora/Plex Mono (Phase 2/5), touching `globals.css` `.dt-*` (Phase 3), the `!important` pair (never).
2. **Kit structure (opt-in variant, gated):** a new `EdPageHero` mode — `variant="product"` — that renders: product label (15/600) → h1 (≤ 2 lines) → one sentence → one filled CTA + one text link → `product` slot (a frame). `EdProse` gains a `maxParagraphs` guard that warns in dev when more than two paragraphs precede the first `product`/table/list. A `scripts/design-audit/kit-gate.sh` grep fails CI after Phase 2 if any page still uses the legacy hero, so the coexistence cannot become permanent the way the last two migrations did.
3. **The two pages:**
   - `/pricing` (`frontend/src/app/pricing/PricingPageContent.tsx` **only** — see the §2.2 correction; `PricingTable.tsx` is not on this page and moves to Phase 3 with `/billing`): plans above the fold on 375×812 (target: first price ≤ 1 screen, measured with the same in-page script), h1 unchanged in wording (it is also the `<title>` key — §9). The eight-line paragraph is `t('pricing.description')`, which is **also** `descKey` for the `<meta description>` in `createMarketingLocalePage` — so it is not edited; it moves below the plans, and the one sentence under the h1 is a **new** key `pricing.heroLine` via `tOr()` (an addition, not a change — consistent with "no copy changes"). The refund notice goes into the plan-card footnote; one filled CTA per plan card and none in the hero. The plan cards are already editorial-kit components, so this page needs **restructuring only, no repalette** — which makes Phase 1 smaller and safer than first scoped. Giving `PricingTable` a `surface="editorial"` prop (the `DocumentDiffPanel surface="app"|"editorial"` precedent) moves to **Phase 3**, where `/billing` is already listed.
   - `/` (`components/landing/HeroSection.tsx`, `HeroCollage.tsx` retired, new `components/landing/ProductFrame.tsx`): claim (existing `landing.headline`, roman, two lines), one sentence, one CTA ("Start with a sample doc" → `/demo`), "Sign up free" as a text link, then the **product frame** — a static, server-rendered DOM composition of the reader: a document page with the evidence highlight on a real passage from the finance seed PDF, and beside it one answer with a citation chip, built from the new tokens (not a screenshot, not Remotion, not the app components yet). **Its content depends on Open Question 1:** under A2 the frame shows the full reader (header + chat column + page) styled to what the reader will look like after Phase 4, and becomes the visual spec for it; under A1 it shows *only* the reader pane (cream chat column + white page) and never the cool app header, because a zinc/blue header cannot sit on paper. Stat band, `FeatureGrid` visuals and `SocialProof` numbers retired; `FeatureGrid` becomes three rows of claim + one-line body; `FinalCTA` steps down from `.ed-display` to title-1 so the landing has one display-1 headline; `ScrollReveal` removed (and its consumers `FeatureGrid`, `HowItWorks`, `SocialProof`, `SecuritySection`, `FAQ`, `FinalCTA` edited). `ProductShowcase.tsx`, `ShowcasePlayer*.tsx`, `HeroArtifact.tsx`, `showcaseData.ts` and the `remotion` / `@remotion/player` dependencies are deleted (dead code; Open Question 4 confirms).
- **i18n:** zero headline/paragraph changes; new strings only inside `ProductFrame` (the sample question/answer), shipped via `tOr()` with English fallback and translated in Phase 2. Flat dotted keys.
- **SEO:** h1/h2/h3 elements and their strings unchanged; JSON-LD, sitemap, `MarketingLocaleLinks`, metadata untouched; the product frame is SSR DOM (LCP-safe, no client-only hero).
- **Judge:** `/` and `/pricing` in light and dark, at 375 and 1440, in `en`, `de` (longest Latin headline, 20 chars/line), `ja` (sans display, weight 600, tracking 0) and `ar` (RTL, no negative tracking). Measured: first price on `/pricing` ≤ 1 screen at 375×812; zero text below 12px; zero `.ed-glass` outside header/popover; contrast audit clean; `npm run build` green; a spot-check of five untouched kit routes confirms tokens applied and nothing broke.
- **Codex:** **required** — SSR/metadata-adjacent (`EdPageHero` is the h1 of 46 routes), `/pricing` carries the `upgrade_click` CTAs and `billingHref()` targets, and the diff is well over 30 lines of logic. Also the moment to rewrite the rule text (§8) — same commit series.

### Phase 2 — The other 43 kit routes, the hubs, aux pages, and copy grammar (2–3 weeks; after the disavow window if the owner wants rankings measurable — Open Question 3)
- Order inside the phase follows the Jev table: the five hubs first (one dominant action each: "Compare with ChatPDF" etc. on `/compare`, the demo on `/features`, a single document picker on `/tools`), then `/compare/*` and `/alternatives/*` (headlines rewritten from titles into claims; each gets the product frame with the competitor-relevant highlight), then `/use-cases/*`, then `/features/*`, `/trust`, `/about`, `/contact`, legal, `blog/*`, `shared/[token]` (all onto `MarketingShell`; `PublicHeader` retired).
- **Before any headline changes:** decouple `titleKey` from the h1 key in `lib/marketingLocalePage.ts` and `[locale]/page.tsx` (§9 #3) so `<title>` tags stay put while h1s change, or change both deliberately with GSC watching.
- Every copy change ships in all 11 locales (`tOr()` fallback first, translation batch second). Plex Mono and Sora unload at the end of this phase once `grep -r "dt-mono\|font-logo\|font-mono"` is clean on the marketing surface.
- **Judge:** Jev re-run on all 40 routes with identical questions; targets: prose-first > 0.5 on ≤ 5 routes, headline grammar mean ≥ 2.5, competing actions > 0.5 on 0 routes.
- **Codex:** required for the metadata/title decoupling and the `PublicHeader` removal; the copy batches themselves need the i18n parity check, not Codex.

### Phase 3 — App shell and dashboard onto the one system (A2) (2 weeks)
- **Gate first (rigour):** `scripts/design-audit/` — Playwright with a test-account storage state runs `extract_fold.py` + the four Jev questions against `/` (authenticated) and `/d/{demo-id}`; a computed-style census per viewport (distinct `font-family`, text nodes < 13px, distinct `border-radius`, distinct surface colours, count of toolbar-like regions). Numbers before, numbers after.
- `AppHeaderShell` + `PublicHeader` → one `AppHeader` on paper tokens with `.dt-glass` and the scroll-edge hairline; the `--workbench-*` block in `globals.css` deleted (76 references re-pointed to `--stage/--surface/--ink-*`); `DashboardPageClient`: the upload zone is the fold and the one filled action; `PrivacyBadge` becomes one line at 13px under it; URL import and "Try demo" are text-level; the native `<select>` is styled; document rows on 15px with a single meta line; `ModeSelector` and pills on the radius scale. `billing`, `profile`, `collections`, `auth` re-pointed from zinc utilities to tokens (mechanical). Tailwind `borderRadius` remapped (§5.2) — this touches ~565 class sites at once, so it lives here with before/after screenshots of every route.
- **Cascade traps resolved here, before any `backdrop-filter`:** remove `isolation: isolate` from `.dt-stitch-theme`/`.dt-shell-header`, reconcile `.dt-shell-header{z-index:80}` vs JSX `z-30`, and remember `.dt-*` rules sit after `@tailwind utilities` so deleting one can *un-hide* a Tailwind utility that was silently losing.
- **Judge:** the census (target: 1 family, 0 nodes < 12px, ≤ 5 radii, ≤ 6 surface colours), golden path in both modes, contrast clean.
- **Codex:** **required** (cascade traps, 76-reference re-point, auth/billing surfaces).

### Phase 4 — The reader (2–3 weeks)
- `--reader-*` retired into the shared tokens (evidence is the one semantic that survives, at the §5.3 values); one toolbar idiom for header, `PdfToolbar` and the composer (`.dt-glass`, 15px controls, radius scale); answer body 17px (`prose` not `prose-sm`), citation chips 12px tabular, disclaimer 13px `--ink-3`; `SourcesStrip`, `CitationCard`, `QuoteFinderPanel`, `SavedQuoteCard` on tokens; the landing `ProductFrame` replaced by a render of the real reader components so marketing and product are literally the same code. Perf red-lines enforced: no blur on `.dt-answer-card`, PDF layers, Recharts.
- **Judge:** golden path (upload → chat → citation jump) in both modes; PDF scroll and SSE streaming smooth; `citation_clicked` rate watched for two weeks.
- **Codex:** **required, adversarial** — this is the surface with the streaming and PDF constraints and the citation UX.

### Phase 5 — Cleanup and documentation (days)
Delete unused tokens, `HeroCollage` remnants, `components/design/SectionKicker`, unused `spell/*`; confirm `remotion` gone from the lockfile; update `docs/ARCHITECTURE.md`, memory notes (`liquid-glass-program`, `theme-removal-program` get a closure banner), and `AGENTS.md`. Version bump = three files (memory rule).

**Why this order:** money and measurement first (`/pricing` + funnel), then the page the owner named, then the seam users hit on day one (dashboard/header), then the hardest and most constrained surface (reader), then paperwork. Phase 3 before Phase 4 because the header is shared and the reader's chrome cannot be unified while the header is still cool-blue.

---

## 8. Rule text that must be rewritten (in the Phase 1 commit series)

**`CLAUDE.md` → "Path-scoped rules" import is unchanged; the stale claims live in `.claude/rules/frontend.md` and the two design sentences below.**

1. `.claude/rules/frontend.md`, "UI Design System", the `Editorial marketing layer` bullet — replace the whole bullet with:
   > **Editorial marketing layer**: the public marketing surface (unauthenticated `/`, `use-cases/*`, `compare/*`, `alternatives/*`, `features/*`, `tools/*`, `pricing`, `trust`, `demo`, and — after Phase 2 of the 2026-09-20 plan — `about`, `contact`, `imprint`, `privacy`, `terms`, `blog/*`, `shared/[token]`) uses the scoped editorial system in `frontend/src/app/editorial.css` (every rule under `.dt-editorial`): paper `#eae8e3` / warm-dark `#171614`, ink, terracotta `#843c28` (dark `#e0957a`), olive = verified only, amber = evidence only. **Light and dark are both required** (HIG). Display type is Fraunces 600 for `h1`/`h2` only; every other glyph is IBM Plex Sans; no inline `font-family` switches, no mono labels, no italic `<em>` in headlines. Structure follows Apple's grammar: product label → one claim (≤ 2 lines) → one sentence → **one** filled CTA → a product frame; prose comes after the product. Liquid Glass (`.dt-glass`) is permitted only on the sticky header and popovers — never on cards, FAQ rows, banners, tables or hero art. The 2026-05-20 decision to keep the paper/terracotta identity stands (re-affirmed by the owner 2026-09-20); its "two surface treatments" clause is superseded by the one-system direction (A2) once Phases 3–4 land. Plan: `.collab/plans/2026-09-20-apple-design-direction.md`.

2. `.claude/rules/frontend.md`, the `Palette (app UI)` bullet — **text depends on Open Question 1.** If **A2**: replace "zinc monochrome + blue accent (`#1D4ED8`/`#60A5FA`)" with "shared paper tokens (`--stage/--surface/--ink-*/--signal/--evidence/--olive/--danger`, see plan §5.3) after Phase 3; until then zinc + blue remains on the app surface." If **A1**: keep "zinc monochrome + blue accent" and add "unified in Phase 3 onto the zinc tokens; `--workbench-*` and `--reader-*` are retired into `--surface-*`/`--accent`; the evidence colour is `#7a4b00` / `#f0b323`." In both cases append: "Zero `gray-*`/`indigo-*`/`violet-*`/`purple-*`; zero `transition-all`; nothing below 12px; radius only from the five-step scale."

3. `CLAUDE.md` "Project" paragraph and `.claude/rules/frontend.md` both say the body font is **Inter** and the editorial fonts are **Newsreader serif + IBM Plex Mono** — stale since v0.28.0. Replace with "IBM Plex Sans body; Fraunces display (marketing h1/h2 only)".

4. `CLAUDE.md` sentence "**Design decision locked 2026-05-20**: the product runs on TWO surface treatments … Do not re-propose merging the accents." → **text depends on Open Question 1.** If **A2**: "**Design decision 2026-09-20 (supersedes 2026-05-20):** the paper/terracotta identity is the brand on every surface; the 2026-05-20 lock is partially vindicated (identity kept) and partially superseded (two-surface split, light-only, content-layer glass and 3px buttons are retired). Do not re-propose a neutral/blue rebrand; do not reintroduce a second surface treatment." If **A1**: "**Design decision 2026-09-20 (amends 2026-05-20):** two surface treatments remain — paper/terracotta marketing, zinc/blue app — but both follow one structural grammar (one dominant action, product first, controls-vs-content materials, light + dark) and one token base for radius, spacing, type ramp and the evidence colour. The 2026-05-20 identity lock stands; its light-only and content-layer-glass clauses are retired. Do not re-propose a neutral/blue rebrand of marketing." Approving this plan does **not** by itself approve A2; Open Question 1 must be answered first.

5. `frontend/src/components/landing/LandingPageContent.tsx` docblock ("Newsreader serif, IBM Plex Mono. Light-only by design") and `EditorialHeaderBase` comments — update in the same commit.

6. `AGENTS.md` mirrors 1–4.

---

## 9. What could make this worse — adversarial pass on my own plan

1. **Coexistence becomes the fifth system.** Every prior migration stalled with a remainder (7 pages never editorialized; Batch 2 never started; a fifth direction still in `tailwind.config.ts`). Mitigation: tokens ship globally in Phase 1, the kit variant is gated by `kit-gate.sh` that fails CI after Phase 2, and no new page may reference `--workbench-*`/`--reader-*` after Phase 3 (grep in CI).
2. **`<title>` and `<meta description>` follow the h1 and lede keys.** `createMarketingLocalePage({ titleKey: 'pricing.headline', descKey: 'pricing.description' })` and `[locale]/page.tsx` (`title = t('landing.headline')`, `description = t('landing.description')`) derive the page metadata from the same keys the hero renders. A Phase 2 headline or lede rewrite silently changes the `<title>`/description of 38 pages × 11 locales — during the window in which the disavow file makes ranking effects unreadable (memory 2026-09-20). Phase 1 changes no headline or description string (it *adds* `pricing.heroLine` and moves `pricing.description` down the page); Phase 2 decouples `titleKey`/`descKey` first.
3. **The `!important` pair** (`globals.css:728-735` `.dt-stitch-root > .min-h-screen { background: transparent !important }` and its `editorial.css:52-55` counter-rule): under Option A `.dt-editorial` survives, so **neither rule is touched in any phase**. An executor who "cleans up" one side blanks the paper on 45 routes (the exact 2026-08-04 bug).
4. **Removing `.dt-*` rules un-hides Tailwind utilities.** Because `.dt-*` sits after `@tailwind utilities`, deleting a rule can let a previously-losing utility win — regressions look random. Per-component screenshot diffs in Phases 3–4.
5. **`backdrop-filter` on the app header samples nothing** until `isolation: isolate` is removed from `.dt-stitch-theme`/`.dt-shell-header` and z-index reconciled (glass spec §5). Do the traps before the material.
6. **Tailwind `borderRadius` remap** changes ~565 class sites in one commit — Phase 3 only, with full-route screenshots.
7. **Locale JSON keys are flat dotted.** A nested key breaks `next build` but not `tsc`/eslint (memory). Every new `ProductFrame` string is flat.
8. **`font-synthesis: none` can reveal a missing bold** on Linux/Windows fallbacks for `hi` (Nirmala UI has Bold; Noto Sans Devanagari is variable) and `ar` (Geeza Pro Bold exists; Segoe UI Bold exists). QA the five non-Latin locales on a non-Apple OS before shipping Phase 1; if a face is missing, the fix is the stack, not re-enabling synthesis.
9. **Dark mode doubles the QA surface.** Phase 1 limits judged routes to three; the other 43 get the dark tokens but are only spot-checked. A dark-mode defect on an unjudged kit page is possible for the Phase 1 window; the alternative (light-only) contradicts the HIG text and the owner's choice.
10. **Owner taste risk.** Three directions have been rejected since April (Instrument Serif, cream+terracotta "AI 味", blue-on-paper). Identity lives in tokens so a taste reversal on colour is a 2-file revert while the structural work stays.
11. **"Generic SaaS" risk under Apple's grammar.** Pills, one accent, cards — the design skill's own warning. Mitigation: the product frame is real and specific (a verbatim highlighted passage with a page-accurate citation is a hero no competitor shows), the paper identity remains, and `EdCardGrid` is used only where content is a set of peers.
12. **The demo → reader seam persists through Phases 1–3.** `/demo` on paper, `/d/[id]` still cool-headed until Phase 3. Accepted; Phase 3 fixes the header first for that reason.
13. **react-pdf assets** (`public/cmaps`, `standard_fonts`, `pdf.worker.min.mjs`) must not move; CSP is `font-src 'self' data:` and `next/font` self-hosts — no CSP change in any phase.
14. **Never `npm run build` while dev runs** (memory) — it kills the dev server's chunks.
15. **The Remotion deletion** removes a dependency; confirm nothing else imports `remotion` before removing it from `package.json`.
16. **Codex sandbox cannot run git or local sockets** — commits from Claude; Codex's integration-test claims must be re-run locally (memory 2026-08-27).

---

## 10. Open questions — ALL ANSWERED BY THE OWNER 2026-09-20

> **Decisions are locked. This section is now a record, not a question list.**
>
> 1. **A1 or A2 → A2.** One paper system across marketing *and* app. Phases 3–4 re-point `--workbench-*` (76 references) and `--reader-*` onto the shared `--stage/--surface/--ink-*/--signal/--evidence/--olive/--danger` tokens. **Consequence for Phase 1:** the landing `ProductFrame` shows the **full reader** (header + chat column + document page) styled to what the reader will look like after Phase 4, and that frame becomes the visual spec for Phase 4. §8 rule rewrites take their **A2** variants.
> 2. **Typeface → Fraunces + IBM Plex Sans.** Fraunces 600 for marketing `h1`/`h2` only; Plex Sans for every other glyph including the wordmark. Sora and IBM Plex Mono retired (Plex Mono unloads at the end of Phase 2, after the label sweep).
> 3. **Headline timing → decouple `titleKey`/`descKey` first, then rewrite h1s.** Do not wait for the disavow window. `lib/marketingLocalePage.ts` and `app/[locale]/page.tsx` are decoupled at the start of Phase 2 so `<title>`/`<meta description>` hold steady while h1s change.
> 4. **Delete the dead Remotion showcase → yes.** `ProductShowcase.tsx` (621), `ShowcasePlayer.tsx` (67), `ShowcasePlayerInner.tsx` (28), `showcaseData.ts` (110), `HeroArtifact.tsx`, plus `remotion` and `@remotion/player` from `package.json`. Re-grep for importers immediately before deleting.
> 5. **Hero document → the finance sample (10-K style)**, so the landing frame and `/demo`'s first card point at the same document.
> 6. **Wordmark → Sora replaced by Plex Sans 600**, −0.02em.
> 7. **Marketing dark mode → ships in Phase 1**, with the tokens. Deep QA on the two judged routes; the other 44 get the tokens and a spot-check.

### Original question text (superseded, kept for audit)

1. **A1 or A2?** Recommendation: **A2 — one paper system across marketing and app** (Phases 3–4), with terracotta as the single dominant action per view and ink-solid as the secondary button style. If **A1** (app stays zinc/blue), Phases 3–4 unify the app onto zinc/blue instead, and the landing product frame may show only the reader pane (cream + white page), never the cool header.
2. **Two families or one?** Recommendation: **Fraunces (marketing h1/h2 only) + IBM Plex Sans (everything else)**. Alternative: Plex Sans only — h1/h2 become Plex Sans 700 at the same sizes with −0.03em tracking; presence from size alone; the serif voice leaves the brand.
3. **When may headline strings (and therefore `<title>`s) change?** Phase 1 changes none. Phase 2's grammar rewrite either waits for the disavow window to settle (so rankings are readable) or proceeds with `titleKey` decoupled so titles hold while h1s change. Which?
4. **Confirm deleting the dead Remotion showcase** (`ProductShowcase.tsx` 621 lines, `ShowcasePlayer*`, `HeroArtifact`, `remotion` + `@remotion/player`).
5. **Which seed document is the hero?** Recommendation: the finance sample (10-K style), so the landing frame and `/demo`'s first card agree.
6. **Wordmark: Sora → Plex Sans 600.** Brand-adjacent; needs a nod.
7. **Marketing dark mode ships in Phase 1** (recommended, tokens are the cheap moment) or is held to Phase 2?

---

## Appendix A — Measurement to close the authenticated-surface gap (Phase 3 gate)

`frontend/scripts/design-audit/` (reusing the scratchpad scripts, checked in):
- `fold_auth.py`: Playwright, `storage_state` from a test account, routes `/`, `/collections`, `/billing`, `/d/{demo-id}`; strips header/footer; extracts h1, first two paragraphs, controls before the first `h2`; feeds the four Jev questions with identical wording to the marketing run so the numbers are comparable.
- `style_census.py`: for each route × {375, 1440} × {light, dark}: distinct computed `font-family`, count of text nodes with computed `font-size < 13px`, distinct `border-radius` values, distinct background colours covering > 0.5% of the viewport, count of regions with ≥ 3 buttons in a row (toolbar idioms), and a computed-style contrast pass (catches Tailwind utility colours the token audit cannot see).
- `contrast_tokens.py`: the existing arithmetic audit, run against `editorial.css` + `globals.css` tokens; CI-fails on any pair < 4.5.
Targets after Phase 4: 1 font family on app routes (2 on marketing), 0 text nodes < 12px, ≤ 5 radii, ≤ 6 surfaces per viewport, 1 toolbar idiom on `/d/[id]`, 0 contrast failures.

## Appendix B — Files touched per phase (for scoping)

| Phase | Files |
|---|---|
| 0 | `app/editorial.css`, `app/globals.css` |
| 1 | `app/editorial.css`, `app/layout.tsx` (theme-color), `components/marketing/{EdPageHero,EdProse,EdCardGrid,EdFaqList,EdCtaBanner,EdComparisonTable,EditorialHeaderBase}.tsx`, `components/landing/{HeroSection,FeatureGrid,SocialProof,HowItWorks,SecuritySection,FAQ,FinalCTA,LandingPageContent}.tsx` (the last six are `ScrollReveal` consumers), new `components/landing/ProductFrame.tsx`, delete `HeroCollage.tsx`, `HeroArtifact.tsx`, `ProductShowcase.tsx`, `ShowcasePlayer*.tsx`, `showcaseData.ts`, `ScrollReveal.tsx`; `app/pricing/PricingPageContent.tsx`; `i18n/locales/en.json` (+ `pricing.heroLine`, `ProductFrame` strings via `tOr`); `package.json` (remotion); `.claude/rules/frontend.md`, `CLAUDE.md`, `AGENTS.md`; `scripts/design-audit/kit-gate.sh` |
| 2 | 43 `*Content.tsx`/`*Client.tsx` under `app/{compare,alternatives,use-cases,features,tools,trust,about,contact,imprint,privacy,terms,blog,shared}`, `lib/marketingLocalePage.ts`, `app/[locale]/page.tsx`, 11 locale JSONs, `components/PublicHeader.tsx` (delete), `app/layout.tsx` (unload Sora, Plex Mono) |
| 3 | `app/globals.css` (workbench block, `.dt-shell-header`, isolation), `tailwind.config.ts` (radius, fontFamily), `components/{AppHeaderShell,Header,ThemeSelector,LanguageSelector,ModeSelector,PrivacyBadge,CreditsDisplay,UserMenu}.tsx`, `components/dashboard/DashboardPageClient.tsx`, `components/PricingTable.tsx` (moved here from Phase 1 — see the §2.2 correction), `app/{billing,profile,collections,auth}/*`, `scripts/design-audit/{fold_auth,style_census,contrast_tokens}.py` |
| 4 | `app/d/[documentId]/DocumentReaderPageClient.tsx`, `components/Chat/*`, `components/PdfViewer/{PdfToolbar,PdfViewer}.tsx`, `components/Quotes/*`, `components/{DocumentBrief,Extraction,LayoutTranslation}/*`, `app/globals.css` (reader block, `.dt-answer-card`, `.dt-composer`), `components/landing/ProductFrame.tsx` (→ real components) |
| 5 | leftovers, docs, memory, version bump (3 files) |
