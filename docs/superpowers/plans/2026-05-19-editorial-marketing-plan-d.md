# Editorial Marketing — Plan D: Pricing + Trust + Demo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Re-skin the three remaining in-scope marketing pages — `pricing`, `trust`, `demo` (index) — into the editorial marketing layer. These are bespoke pages (rich plan cards, security control cards, a live demo-document grid); they reuse the kit where it fits and use editorial-token inline markup where the content shape exceeds the kit. This completes Phase 2.

**Architecture:** `MarketingShell` + editorial kit composition, with bespoke `ed-card`-style tiles for the rich card shapes. Spec: `docs/superpowers/specs/2026-05-19-editorial-marketing-phase2-design.md`. Plans A/B/C are complete. Reference conversions: `frontend/src/app/use-cases/lawyers/LawyersClient.tsx`, `frontend/src/app/features/citations/CitationsClient.tsx` (for the inline editorial table pattern).

**Tech Stack:** Next.js 14 App Router, React, Tailwind, `editorial.css` scoped layer, lucide-react, `i18n` `useLocale()`.

**Kit components** (`frontend/src/components/marketing/`): `MarketingShell`, `EditorialMarketingHeader`, `EdPageHero`, `EdSection`, `EdProse`, `EdFeatureList`, `EdCardGrid`, `EdStepRow`, `EdFaqList`, `EdCtaBanner`, `EdComparisonTable`, `EdInlineCell`, `EdRelatedLinks`, `EdCheckList`, `EdChoiceList`. Editorial CSS classes (`.dt-editorial`-scoped): `ed-shell ed-rule ed-section ed-h1 ed-h2 ed-h3 ed-lede ed-body ed-label ed-label-num ed-caption ed-num ed-cta ed-link ed-card ed-crumb ed-prose ed-inline`. `--ed-*` variables: `--ed-paper --ed-paper-2 --ed-ink --ed-ink-2 --ed-ink-3 --ed-signal --ed-signal-deep --ed-ochre --ed-rule`.

**Conventions (every task):**
- `page.tsx` server wrappers never touched. `t(...)`/`tOr(...)` keys never changed; no new copy invented. Hardcoded English (trust page) kept verbatim.
- **Functional logic is preserved exactly:** the demo page's data fetch / loading / error / retry state and the `/d/<id>` links; the pricing page's `trackEvent` analytics calls and `billingHref(...)` CTA hrefs. Only chrome + visual styling changes.
- Remove `dt-stitch-theme` / `dt-stitch-card` leftover classes and `--workbench-*` CSS-var usages (replace with editorial tokens).
- Light-only, no `dark:` variants. No `gray-*`/`indigo-*`/`violet-*`/`purple-*`, no `accent`/`accent-light`/`accent-foreground`/`accent-hover` classes, no emerald/amber-as-decoration, no glass/gradient/glow. Colors from `--ed-*` / `ed-*`. (Editorial uses `--ed-ochre` where a second accent is needed, `--ed-signal` for the primary accent.)
- Kit components render inside `MarketingShell`'s `dt-editorial` root — pages must not add `dt-editorial`.
- `alt` alternation: adjacent `<EdSection>`s differ in tone.
- Pages that fetch data must keep meaningful loading AND error states (Soft-404 rule).
- `npm run build` must pass at the end of every task; commit at the end of every task.

---

### Task 1: Convert the pricing page

**File:** Modify `frontend/src/app/pricing/PricingPageClient.tsx`.

- [ ] **Step 1: Read** `PricingPageClient.tsx` in full, the kit components, and the reference `frontend/src/app/features/citations/CitationsClient.tsx` (inline table pattern).

- [ ] **Step 2: Convert.** Keep `"use client"`, the `useLocale` import, the `plans` and `comparisonRows` data arrays, the `creditGuide` array, the `billingHref`/`trackEvent` imports and EVERY `trackEvent(...)` call and `billingHref(...)` href EXACTLY. Replace the returned JSX:
  - Remove the `dt-stitch-theme` root. Root → `<MarketingShell breadcrumb={[{label: t('useCasesHub.breadcrumb.home'), href:'/'}, {label: t('pricing.eyebrow') or a "Pricing" label}]}>`.
  - Hero → `<EdPageHero eyebrow={t('pricing.eyebrow')} title={t('pricing.headline')} lede={t('pricing.description')} primaryCta={{ label: t('pricing.plus.cta'), href: billingHref({ plan:'plus', source:'pricing_hero' }) }} secondaryCta={{ label: t('pricing.tryDemo'), href:'/demo' }} />`. **IMPORTANT:** the hero's primary CTA had a `trackEvent('upgrade_click', { plan:'plus', period:'monthly', source:'pricing_hero' })` onClick — `EdPageHero`'s `primaryCta` is a plain `{label,href}` with no onClick. To preserve the analytics event, EITHER render the hero CTA row manually instead of via `EdPageHero`'s `primaryCta` prop (a manual `<Link onClick={...} className="ed-cta">` placed via `EdPageHero`'s `children`/`meta` slot or just after the hero), OR keep `primaryCta` for the href and accept the tracking is on the plan-card CTAs only — NO: the hero tracking must be preserved. Render the hero CTAs manually: pass `EdPageHero` only `eyebrow`/`title`/`lede`, then render a CTA row as `EdPageHero`'s `meta` prop (or immediately after it) containing a `<Link className="ed-cta" onClick={() => trackEvent(...)}>` for the plus CTA and an `ed-link` for the demo CTA.
  - The "7-day fair-use refund" callout → keep it as a small editorial note: a hairline-bordered `ed-card`-style box (or a `<p className="ed-body">` with a bordered inset) containing the `pricing.refundPolicy.title` (bold) + `pricing.refundPolicy.body`. Use `--ed-ochre` or a hairline border for the inset — NOT emerald.
  - The "Credits map to real work" credit-guide aside → an `<EdSection alt title>` (use `tOr('pricing.creditGuide.title', 'Credits map to real work')`) containing the 3 `creditGuide` items as a small editorial list or `<EdCardGrid columns={3} items={creditGuide.map(c => ({ title: c.title, body: c.body, icon: c.icon }))} />`.
  - The 3 plan cards → an `<EdSection>` containing a 3-column grid of bespoke editorial plan cards (`EdCardGrid` is too simple for these). Each plan card is a `<div className="ed-card h-full">` (flex column) with: a mono `ed-label` meter line (`tOr(plan.meterKey, plan.meterFallback)`); the plan name as `ed-h3` (or larger); the featured plan gets a small mono `ed-label` "Most popular" tag colored `var(--ed-signal)`; the summary as `ed-body`; the "fit" note as a hairline-bordered inset `ed-caption`; the price as a large `ed-num` (Newsreader) + the cadence as `ed-caption`; the feature list as an `EdCheckList items={plan.featureKeys.map(k => t(k))}`; and the CTA as a `<Link className="ed-cta">` (full-width) carrying the SAME `href={plan.ctaHref}` and the SAME `onClick` `trackEvent` logic the original had. The featured plan card may be visually emphasized with a `var(--ed-signal)` top border or a slightly different treatment — keep it subtle and editorial.
  - The comparison table → `<EdSection alt title={t('pricing.comparison.title')}>` with `t('pricing.comparison.description')` as a `<p className="ed-lede">`, then the 4-column table (`feature | free | plus | pro`, all string values) rendered as an inline editorial table styled like `CitationsClient.tsx`'s inline table (hairline border + row separators, mono `ed-label` `<th scope="col">` headers, `<th scope="row">` feature names, the Plus column optionally emphasized with `var(--ed-paper-2)`); cell values are plain strings → render them in `ed-body`.
  - The "best fit" aside → an `<EdSection>` with the `pricing.bestFit.*` content: the title as `ed-h2`/`ed-h3`, the 3 fit items as an `EdProse` `<ul>` or a small list (each `<strong>` label + description), and the context note as a `<p className="ed-body">` keeping the inline `/demo`, `/features`, `/compare` `<Link>`s (as `ed-inline`).
  - `alt` alternation across all `<EdSection>`s.
  - Remove old chrome imports (`Header`, `Footer`, decorative icons no longer used). Keep `Check`/`ArrowRight`/the `creditGuide` icons if still referenced; keep `billingHref`, `trackEvent`.

- [ ] **Step 3: Verify.** `cd frontend && npm run build` must PASS. Open `/pricing`; confirm editorial layout, plan cards aligned, table reads correctly, CTAs link to the right billing hrefs.

- [ ] **Step 4: Commit** — `feat(marketing): editorial pricing page`. Stage `frontend/src/app/pricing/`.

---

### Task 2: Convert the trust page

**File:** Modify `frontend/src/app/trust/TrustPageClient.tsx`.

- [ ] **Step 1: Read** `TrustPageClient.tsx` in full and the kit components. Note: the trust page content is intentionally hardcoded English (there is a comment explaining why — the technical control names need precise English). Keep ALL that content verbatim.

- [ ] **Step 2: Convert.** Keep `"use client"`, the `useLocale` import + the `usePageTitle(...)` call, and the data arrays (`encryptionControls`, `ingestControls`, `dataRightsControls`, `gaps`, `trustStats`) UNCHANGED. Replace the returned JSX:
  - Remove the `dt-stitch-theme` root. Root → `<MarketingShell breadcrumb={[{label: t('useCasesHub.breadcrumb.home'), href:'/'}, {label:'Trust & Security'}]}>`.
  - Hero → `<EdPageHero eyebrow="Trust Center" title="The real controls protecting your documents." lede={…the existing hero paragraph verbatim…} />`. The hero's two buttons (Privacy policy / Report security issue) → render as a CTA row (a `<Link className="ed-cta">` to `/privacy` + an `<Link className="ed-link">` to `/contact`) via `EdPageHero`'s `meta` slot or just after it.
  - The "Control summary" aside (`trustStats` — 3 stat tiles + the "Compliance badges are not claimed…" amber note) → an `<EdSection>` (or fold near the hero): render the 3 stats as a small hairline-bordered row of mono `ed-caption` label + `ed-num`/`ed-h3` value tiles; the "Compliance badges…" note as a `<p className="ed-caption">` with a hairline-bordered inset (NOT amber background — use a hairline border + `--ed-ink-3` text, or `--ed-ochre` text).
  - **Re-skin the `ControlCard` component** (it stays a local component) to editorial tokens: a `<div className="ed-card h-full">` flex-column — icon at the top (16–18px, `var(--ed-ink-3)`), the `title` as `ed-h3`, the `detail` as `ed-body`, and the optional `evidence` as a mono `ed-caption` line with a `1px solid var(--ed-rule)` top border (`margin-top:auto` so it pins to the card bottom). No hover-translate, no shadow, no `accent`.
  - The 3 numbered control sections (`01 — Encryption & transit`, `02 — Ingest safety`, `03 — Your data, your control`) → each an `<EdSection num="01"/"02"/"03" title={…}>` (use the kit `EdSection`'s `num` prop — it renders a mono signal-colored number) containing a 3-column grid of the re-skinned `ControlCard`s (`grid grid-cols-1 md:grid-cols-3` + `gap` + `gridAutoRows:'1fr'`).
  - Section `04 — What we don't have yet` (the `gaps` list) → an `<EdSection num="04" title="What we don't have yet">` containing the gaps as a hairline-ruled list: each gap row is a hairline-`borderTop`'d row (`flex`, name+status on the left in a fixed-width column, note on the right) — the `status` rendered in a mono `ed-caption` colored `var(--ed-ochre)` with a small `var(--ed-ochre)` dot. Last row gets a `borderBottom`.
  - The "Report a security issue" contact block → `<EdCtaBanner title="Report a security issue" description={…the existing text…} primary={{ label:'Contact security', href:'/contact' }} secondary={{ label:'Privacy Policy', href:'/privacy' }} />`.
  - `alt` alternation across the `<EdSection>`s.
  - Remove old chrome imports (`Header`, `Footer`); keep the lucide icons used by the control data and `Mail`/`ArrowRight` only if still referenced.

- [ ] **Step 3: Verify.** `cd frontend && npm run build` must PASS. Open `/trust`; confirm editorial layout, the numbered sections, control cards with evidence lines, the gaps list.

- [ ] **Step 4: Commit** — `feat(marketing): editorial trust page`. Stage `frontend/src/app/trust/`.

---

### Task 3: Convert the demo index page

**File:** Modify `frontend/src/app/demo/DemoPageClient.tsx`.

The demo page is **functional**: it fetches demo documents and links into the live product. Preserve all data/state logic exactly.

- [ ] **Step 1: Read** `DemoPageClient.tsx` in full and the kit components.

- [ ] **Step 2: Convert.** Keep `"use client"`, the `useLocale` import, `usePageTitle(...)`, the `SAMPLE_CONFIG` const, and inside the component: the `useState` hooks (`docs`, `loading`, `error`), `fetchDocs`, the `useEffect`, the `docsBySlug` map, and the per-card `isReady`/`isPending`/`suggestedQuestion` logic and the conditional `<Link href={`/d/${doc.document_id}?question=…`}>` vs `<div>` rendering — ALL byte-for-byte unchanged. Replace only the JSX chrome + styling:
  - Remove the `dt-stitch-theme` root. Root → `<MarketingShell breadcrumb={[{label: t('demo.backToHome') or 'Home', href:'/'}, {label: t('footer.demo')}]}>`. (The demo page currently has no footer — `MarketingShell` adds the editorial footer, which is fine.)
  - Hero → `<EdPageHero eyebrow={tOr('demo.eyebrow', 'Public demo')} title={t('demo.title')} lede={t('demo.subtitle')} />`. The two pill badges (`demo.freeMessages`, `demo.citationPromise`) → render as a small mono `ed-caption` row after the hero, or as `EdPageHero`'s `meta`.
  - The "What you will test" 3-step aside → `<EdSection title={tOr('demo.flow.title','What you will test')}>` with the 3 steps as an `<EdStepRow steps={[{title:'', body: step1}, …]} />` — OR a simple 3-column mono-numbered list. (`EdStepRow` shows big numerals — good fit; pass each step's text as `body` and leave `title` empty, or put the step text as `title`. Pick whichever reads cleanly.)
  - The error state → keep the conditional `{error && (…)}` block but re-skin it editorially: a hairline-bordered inset (`1px solid var(--ed-rule)`), `var(--ed-ochre)` text for the message, the Retry `<button onClick={fetchDocs}>` as an editorial button (mono or `ed-cta`-style). Keep `fetchDocs` wired to `onClick`.
  - The 3 sample-document cards → a `<EdSection>` with a 3-column grid. Each card is re-skinned from the dark-glass `dt-stitch-card` to a `<div className="ed-card">` (or `<Link className="ed-card">` when ready) — editorial paper/hairline styling: the badge + pages line as mono `ed-caption`; the icon plate hairline-bordered; the title as `ed-h3`; the description as `ed-body`; the "Suggested question" inset as a hairline-bordered box with a mono `ed-caption` label + the question in `ed-body` italic or Newsreader; the footer row (`ready`/`preparing` + "Open sample →") as mono `ed-caption` / `ed-link`. The `isPending` "Loading/Processing" pill → a mono `ed-caption` with the `Loader2` spinner kept. Replace ALL `--workbench-ink`/`--workbench-muted` CSS vars and `bg-white/7`/`border-white/12` glass classes with editorial tokens (`var(--ed-ink)`, `var(--ed-ink-2/3)`, `var(--ed-paper-2)`, `var(--ed-rule)`). The conditional `Link` vs `div` and all hrefs stay.
  - The footer hint row (`demo.hint` + "← back to home") → keep as a small `ed-caption` / `ed-link` row, or drop the "back to home" since `MarketingShell` has a full footer — keep `demo.hint` as a closing `<p className="ed-caption">`.
  - `alt` alternation across `<EdSection>`s. Remove old chrome imports (`Header`); keep `Link`, the lucide icons used (`ArrowRight`, `Loader2`, the `SAMPLE_CONFIG` icons, etc.).
  - **Loading/error states must still render meaningful content** (Soft-404 rule) — verify the page renders a sensible editorial layout while `loading` and on `error`.

- [ ] **Step 3: Verify.** `cd frontend && npm run build` must PASS. Confirm: the demo-document fetch still runs, loading state shows, error state + Retry works, ready cards link to `/d/<id>?question=…`. Spot-check that the functional app UI (`/auth`, the reader) is unaffected.

- [ ] **Step 4: Commit** — `feat(marketing): editorial demo index page`. Stage `frontend/src/app/demo/DemoPageClient.tsx`.

---

## Self-review notes

- **Spec coverage:** Task 1 = pricing, Task 2 = trust, Task 3 = demo index — the three remaining Phase 2 pages. After Plan D, the full Phase 2 named scope is complete.
- **Functional integrity:** Task 1 explicitly preserves `trackEvent`/`billingHref`; Task 3 explicitly preserves the demo fetch/state/links. Both have verification steps.
- **No new kit components:** the rich plan cards and control cards are bespoke `ed-card`-style inline markup; the existing kit covers the rest.
- **No fabricated copy:** every string is an existing `t(...)`/`tOr(...)` key or the trust page's pre-existing hardcoded English.
