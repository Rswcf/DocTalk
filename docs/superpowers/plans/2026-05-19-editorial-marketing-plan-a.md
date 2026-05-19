# Editorial Marketing — Plan A: Kit + Use-Cases Family

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared editorial marketing component kit (`components/marketing/`), then re-skin the 10 use-cases pages + the use-cases hub into the editorial design layer.

**Architecture:** A kit of composable `.dt-editorial`-scoped components. Per-page clients keep their `useLocale()`/`t()` data assembly and JSON-LD untouched; only the JSX body is replaced with kit composition. Spec: `docs/superpowers/specs/2026-05-19-editorial-marketing-phase2-design.md`.

**Tech Stack:** Next.js 14 App Router, React, Tailwind, `editorial.css` scoped CSS layer, lucide-react, `i18n` `useLocale()`.

**Conventions for every task:**
- All new components are `"use client"` and render only markup inside a `.dt-editorial` ancestor (the kit's `MarketingShell` supplies the root).
- Use the existing editorial vocabulary classes from `editorial.css`: `ed-shell ed-rule ed-section ed-h2 ed-h3 ed-lede ed-body ed-label ed-label-num ed-caption ed-num ed-cta ed-link ed-figure ed-halftone ed-crosshair`, plus the three new classes added in Task 1 (`ed-h1`, `ed-card`, `ed-crumb`).
- No `gray-*`/`indigo-*`/`violet-*`/`purple-*`, no glass/gradient/glow. Colors come from the `--ed-*` CSS variables (used via inline `style` or the `ed-*` classes), not Tailwind color classes.
- Light-only: never emit `dark:` variants in editorial markup.
- `npm run build` must pass at the end of every task.
- Commit at the end of every task.

---

### Task 1: Editorial CSS additions + marketing header + shell

**Files:**
- Modify: `frontend/src/app/editorial.css`
- Create: `frontend/src/components/marketing/EditorialMarketingHeader.tsx`
- Create: `frontend/src/components/marketing/MarketingShell.tsx`

- [ ] **Step 1: Add three classes to `editorial.css`** (append before the `*:focus-visible` rule, all scoped under `.dt-editorial`):

```css
/* Inner-page hero headline — quieter than the landing .ed-display. */
.dt-editorial .ed-h1 {
  font-family: var(--font-newsreader), Georgia, serif;
  font-weight: 500;
  font-size: clamp(34px, 4.6vw, 56px);
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--ed-ink);
}

/* Hairline-bordered editorial card on the inset paper tone. */
.dt-editorial .ed-card {
  border: 1px solid var(--ed-rule);
  background: var(--ed-paper-2);
  padding: 22px;
}

/* Breadcrumb trail link. */
.dt-editorial .ed-crumb {
  font-family: var(--font-plex-mono), ui-monospace, monospace;
  font-size: 10.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ed-ink-3);
  text-decoration: none;
  transition: color 150ms ease;
}
.dt-editorial a.ed-crumb:hover { color: var(--ed-signal); }
```

- [ ] **Step 2: Create `EditorialMarketingHeader.tsx`** — a compact inner-page masthead. Base it on `frontend/src/components/landing/EditorialHeader.tsx` (read it for the exact masthead bar markup), with these changes:
  - Drop the editorial dateline block (`STUDIO Nº 01` / `DOCUMENT INTELLIGENCE`) and its vertical hairline separator — keep only logo + `DocTalk` wordmark.
  - Keep the same sticky bar (`h-16`, `var(--ed-paper)` background, `1px solid var(--ed-rule)` bottom border), the same nav links (`/features`, `/pricing`, `/trust`) and the same `ed-cta` "Sign in" button.
  - Accept a prop `breadcrumb?: { label: string; href?: string }[]`. When non-empty, render a second row below the masthead bar inside `ed-shell`: a `py-3` row with a `1px solid var(--ed-rule)` bottom border, containing the trail. Each entry with an `href` is a `<Link className="ed-crumb">`; the last/no-href entry is a `<span className="ed-crumb" style={{ color: "var(--ed-ink)" }}>`. Separate entries with a mono `/` (`<span className="ed-caption" aria-hidden>` containing `/`).
  - `"use client"`, imports `Link`, `DocTalkLogo`, `useLocale`.

- [ ] **Step 3: Create `MarketingShell.tsx`**:

```tsx
"use client";

import EditorialMarketingHeader from "./EditorialMarketingHeader";
import EditorialFooter from "../landing/EditorialFooter";

interface Crumb { label: string; href?: string; }

export default function MarketingShell({
  breadcrumb,
  children,
}: {
  breadcrumb?: Crumb[];
  children: React.ReactNode;
}) {
  return (
    <div className="dt-editorial min-h-screen flex flex-col">
      <EditorialMarketingHeader breadcrumb={breadcrumb} />
      <main className="flex-1">{children}</main>
      <EditorialFooter />
    </div>
  );
}
```

- [ ] **Step 4:** Run `cd frontend && npm run build`. Expected: PASS (nothing consumes the new components yet; they must still compile).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/editorial.css frontend/src/components/marketing/
git commit -m "feat(marketing): editorial marketing shell + header + CSS primitives"
```

---

### Task 2: Hero, section, prose primitives

**Files:**
- Create: `frontend/src/components/marketing/EdPageHero.tsx`
- Create: `frontend/src/components/marketing/EdSection.tsx`
- Create: `frontend/src/components/marketing/EdProse.tsx`

- [ ] **Step 1: Create `EdSection.tsx`** — a titled editorial section wrapper.
  - Props: `{ label?: string; num?: string; title?: string; alt?: boolean; children: React.ReactNode; id?: string }`.
  - Renders a `<section>` with `ed-section` padding; when `alt`, set `style={{ background: "var(--ed-paper-2)" }}`. A `<hr className="ed-rule" />` is rendered as the section's top edge ONLY when not `alt` (alt sections are visually separated by the tone change).
  - Inside `ed-shell`: if `label`, a mono header line — `<div className="ed-label">` with the `num` (if given) in a `<span className="ed-label-num">` followed by an em-dash and the label text. If `title`, an `<h2 className="ed-h2">` below it (margin-top ~12px). Then `children` in a wrapper with margin-top ~32px.

- [ ] **Step 2: Create `EdPageHero.tsx`** — the editorial page hero.
  - Props: `{ eyebrow?: string; title: React.ReactNode; lede?: string; primaryCta?: { label: string; href: string }; secondaryCta?: { label: string; href: string }; icon?: React.ComponentType<{ className?: string }>; meta?: React.ReactNode }`.
  - Renders a `<section>` with padding `pt-16 pb-14` inside `ed-shell`, `max-width` ~820px on the text block.
  - If `icon`, render it first as a restrained plate: a `44x44` square with `1px solid var(--ed-rule)` border, `var(--ed-paper-2)` background, the icon centered at `20px`, `color: var(--ed-ink-2)`. Margin-bottom ~24px.
  - `eyebrow` → `<div className="ed-label">`. `title` → `<h1 className="ed-h1">`. `lede` → `<p className="ed-lede">` (margin-top ~18px, `max-width` ~620px).
  - `meta` (optional node, e.g. an article byline) rendered after the lede.
  - CTA row (margin-top ~28px, `flex gap-4 items-center flex-wrap`): `primaryCta` → `<Link className="ed-cta">`; `secondaryCta` → `<Link className="ed-link">` with a trailing `→`.

- [ ] **Step 3: Create `EdProse.tsx`** — editorial long-form prose column.
  - Props: `{ children: React.ReactNode; className?: string }`.
  - Renders a `<div>` with `max-width` ~660px and a CSS rule that styles descendant `<p>` as `ed-body` with `margin-bottom: 18px` and descendant `<a>` as editorial inline links. Simplest robust approach: render children inside `<div className="ed-prose">` and add a scoped block to `editorial.css`:

```css
.dt-editorial .ed-prose { max-width: 660px; }
.dt-editorial .ed-prose p {
  font-size: 15.5px;
  line-height: 1.7;
  color: var(--ed-ink-2);
  margin: 0 0 18px;
}
.dt-editorial .ed-prose p:last-child { margin-bottom: 0; }
.dt-editorial .ed-prose a {
  color: var(--ed-signal);
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

  Add that CSS block in this task (modify `editorial.css`). The `EdProse` component itself is then just the `ed-prose` wrapper div. The consuming page passes raw `<p>`/`<a>` children.

- [ ] **Step 4:** Run `cd frontend && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/marketing/ frontend/src/app/editorial.css
git commit -m "feat(marketing): editorial hero, section, prose primitives"
```

---

### Task 3: Feature list, card grid, step row

**Files:**
- Create: `frontend/src/components/marketing/EdFeatureList.tsx`
- Create: `frontend/src/components/marketing/EdCardGrid.tsx`
- Create: `frontend/src/components/marketing/EdStepRow.tsx`

- [ ] **Step 1: Create `EdFeatureList.tsx`** — numbered editorial entries.
  - Props: `{ items: { title: string; body: string; icon?: React.ComponentType<{ className?: string }> }[] }`.
  - Renders the items as hairline-ruled rows in a single column. Each row: a CSS grid `grid-template-columns: 56px 1fr` (mono number column | content), `gap` ~24px, `padding` `28px 0`, with a `1px solid var(--ed-rule)` top border on every row except the first.
  - Number column: a mono two-digit index (`01`, `02`, …) in `ed-label` style but larger (`13px`), color `var(--ed-signal)`.
  - Content column: optional `icon` (16px, `var(--ed-ink-3)`, margin-bottom 10px), `<h3 className="ed-h3">` title, `<p className="ed-body">` body (margin-top 6px).

- [ ] **Step 2: Create `EdCardGrid.tsx`** — uniform editorial card grid.
  - Props: `{ items: { label?: string; title: string; body: string; icon?: React.ComponentType<{ className?: string }> }[]; columns?: 2 | 3 }` (default `columns = 3`).
  - Renders a CSS grid, `columns` columns at `>=640px` / 1 column below, `gap` ~16px, `grid-auto-rows: 1fr`.
  - Each item is a `<div className="ed-card h-full">` with a `flex flex-col`: optional `icon` (16px, `var(--ed-ink-3)`), optional `label` (`ed-label`, margin-bottom 8px), `<h3 className="ed-h3">` (size 17px is fine — keep `ed-h3`), `<p className="ed-body">` body (margin-top 8px).

- [ ] **Step 3: Create `EdStepRow.tsx`** — the three-step "how it works" row.
  - Props: `{ steps: { title: string; body: string; icon?: React.ComponentType<{ className?: string }> }[] }`.
  - Renders a grid: `steps.length` columns at `>=640px` / 1 column below, `gap` ~32px.
  - Each step: a large Newsreader numeral via `<div className="ed-num">` showing the 1-based index; a `1px solid var(--ed-rule)` top hairline above the numeral with `padding-top` ~20px; optional `icon` (18px, `var(--ed-ink-3)`, margin-top 14px); `<h3 className="ed-h3">` (margin-top 12px); `<p className="ed-body">` (margin-top 6px).

- [ ] **Step 4:** Run `cd frontend && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/marketing/
git commit -m "feat(marketing): editorial feature list, card grid, step row"
```

---

### Task 4: FAQ list + CTA banner

**Files:**
- Create: `frontend/src/components/marketing/EdFaqList.tsx`
- Create: `frontend/src/components/marketing/EdCtaBanner.tsx`

- [ ] **Step 1: Create `EdFaqList.tsx`** — hairline-ruled Q&A accordion.
  - Props: `{ items: { question: string; answer: string }[] }`.
  - `"use client"`, controlled open state (`useState<number | null>`), one open at a time.
  - Each item is a row with a `1px solid var(--ed-rule)` top border (all rows) and a final `1px solid var(--ed-rule)` bottom border on the list. The question is a full-width `<button>` (`py-5`, `flex justify-between items-baseline gap-6`, `text-align:left`): a mono question number (`ed-caption`, `var(--ed-signal)`, e.g. `Q1`) + the question text in `ed-h3` style; a mono `+`/`−` indicator on the right (`ed-caption`). `aria-expanded` on the button.
  - The answer: an `<p className="ed-body">` revealed when open, `padding-bottom: 20px`, `max-width: 660px`. Animate with a `max-height`/`opacity` transition consistent with the existing landing FAQ (read `frontend/src/components/landing/FAQ.tsx` for the pattern; reuse the measured-height approach).
  - Focus-visible handled by the global `.dt-editorial *:focus-visible` rule.

- [ ] **Step 2: Create `EdCtaBanner.tsx`** — editorial closing CTA.
  - Props: `{ title: string; description?: string; primary: { label: string; href: string }; secondary?: { label: string; href: string } }`.
  - Renders a `<section className="ed-section">` with `alt`-style background (`style={{ background: "var(--ed-paper-2)" }}`) and a `1px solid var(--ed-rule)` top border. Inside `ed-shell`, centered, `max-width` ~640px: `<h2 className="ed-h2">` title; optional `<p className="ed-lede">` description (margin-top 14px); a CTA row (margin-top 26px, centered `flex gap-4 flex-wrap justify-center`) — `primary` → `<Link className="ed-cta">`, `secondary` → `<Link className="ed-link">` with trailing `→`.

- [ ] **Step 3:** Run `cd frontend && npm run build`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/marketing/
git commit -m "feat(marketing): editorial FAQ list + CTA banner"
```

---

### Task 5: Convert the use-cases hub + the lawyers page (pilot)

This task proves the kit end-to-end. **Do the lawyers page first** — it exercises every kit component — then the hub.

**Files:**
- Modify: `frontend/src/app/use-cases/lawyers/LawyersClient.tsx`
- Modify: `frontend/src/app/use-cases/UseCasesHubClient.tsx`

- [ ] **Step 1: Read the current files.** Read `LawyersClient.tsx` and `UseCasesHubClient.tsx` in full. Read every kit component created in Tasks 1–4 so you know the exact prop shapes.

- [ ] **Step 2: Convert `LawyersClient.tsx`.** Keep the top of the component **unchanged**: the `"use client"` directive, all imports of `useLocale`, the `featureKeys`/`docTypeKeys`/etc. arrays, and every `t(...)` data-assembly block (`faqItems`, `features`, `docTypes`, `securityItems`, `steps`). Only the returned JSX changes. Replace the old `<div className="min-h-screen … bg-white …"> <Header variant="minimal" /> … <Footer /> </div>` tree with:
  - `<MarketingShell breadcrumb={[{ label: t('useCasesLawyers.breadcrumb.home'), href: '/' }, { label: t('useCasesLawyers.breadcrumb.useCases'), href: '/use-cases' }, { label: t('useCasesLawyers.breadcrumb.current') }]}>` as the root (it supplies the `dt-editorial` root, header, `<main>`, footer — so drop the old breadcrumb `<nav>`, the old `<Header>`, the old `<Footer>`, and the manual `<main>`).
  - `<EdPageHero icon={Scale} title={t('useCasesLawyers.heroTitle')} lede={t('useCasesLawyers.heroDescription')} primaryCta={{ label: t('useCasesLawyers.heroCta'), href: '/demo' }} />`. (The old `ArticleMeta` byline is dropped — editorial pages do not show it; this is intentional and consistent across the family.)
  - The "challenge" section → `<EdSection num="01" label={t('useCasesLawyers.challenge.title')} title={t('useCasesLawyers.challenge.title')}>` … actually use the section heading as the `title` and a short mono `label` is optional; pass `title={t('useCasesLawyers.challenge.title')}` only. Inside, an `<EdProse>` containing the four `<p>` paragraphs (keep the two external `<a>` links — they will pick up `.ed-prose a` styling automatically).
  - "How DocTalk helps" → `<EdSection title={t('useCasesLawyers.howItHelps.title')}>` containing `<EdFeatureList items={features.map(f => ({ title: f.title, body: f.description, icon: f.icon }))} />`.
  - "Document types" → `<EdSection alt title={t('useCasesLawyers.docTypes.title')}>` with the description paragraph (in an `<EdProse>` or a plain `<p className="ed-body">` carrying the inline `/features/multi-format` link as an `ed-inline` `<Link>`), then `<EdCardGrid columns={2} items={docTypes.map(d => ({ title: d.format, body: d.detail }))} />`.
  - "Real-world use cases" → `<EdSection title={t('useCasesLawyers.realWorld.title')}>` containing the stacked prose entries: for each `useCaseKeys` entry, an `<h3 className="ed-h3">` + an `<EdProse>` with `p1` and (if truthy) `p2`.
  - "Why citations" → `<EdSection alt title={t('useCasesLawyers.whyCitations.title')}>` with an `<EdProse>` of the four paragraphs (keep the inline `/features/citations` `<Link>`).
  - "Security & privacy" → `<EdSection title={t('useCasesLawyers.security.title')}>` with the description as a `<p className="ed-body">` then `<EdCardGrid columns={2} items={securityItems.map(s => ({ title: s.title, body: s.detail, icon: s.icon }))} />`.
  - "Getting started" → `<EdSection alt title={t('useCasesLawyers.steps.title')}>` with `<EdStepRow steps={steps.map(s => ({ title: s.title, body: s.description, icon: s.icon }))} />`.
  - "FAQ" → `<EdSection title={t('useCasesLawyers.faq.title')}>` with `<EdFaqList items={faqItems} />`.
  - Closing → `<EdCtaBanner title={t('useCasesLawyers.cta.title')} description={t('useCasesLawyers.cta.description')} primary={{ label: t('useCasesLawyers.cta.tryFreeDemo'), href: '/demo' }} secondary={{ label: t('useCasesLawyers.cta.viewPricing'), href: '/pricing' }} />` (placed as the last child of `MarketingShell`, after the FAQ section).
  - Remove now-unused imports (`Header`, `Footer`, `ArticleMeta`, `ChevronRight`, `ArrowRight` if unused). Keep the lucide icon imports that feed `featureIcons`/`securityIcons`/`stepIcons`/the hero (`Scale`).

- [ ] **Step 3: Convert `UseCasesHubClient.tsx`.** Read it first. It is a hub: a hero + a card index of the 10 use-case pages + a CTA. Convert to `<MarketingShell breadcrumb={[home, current]}>` + `<EdPageHero …>` + `<EdSection>` wrapping `<EdCardGrid columns={3} items={…} />` where each card's `title` is the vertical name and `body` its short description, and the **whole card links** to the child page — `EdCardGrid` cards are not links by default, so for the hub render the card grid manually with `<Link className="ed-card h-full">` wrappers, OR (preferred) keep using `EdCardGrid` and place the index as a separate manual `<Link>` grid if linking is needed. Choose the manual `<Link>` grid for the hub so each card is clickable; mirror `ed-card` styling exactly. End with `<EdCtaBanner>`. Preserve all `t(...)` data and any JSON-LD-free logic.

- [ ] **Step 4: Verify.** Run `cd frontend && npm run build` (must PASS). Then start/confirm the dev server and open `/use-cases/lawyers` and `/use-cases` in a browser: confirm paper background, Newsreader headlines, mono labels, hairline rules, breadcrumb row, no glass/gradient, signal-red used sparingly; the FAQ accordion opens; all links work.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/use-cases/
git commit -m "feat(marketing): editorial use-cases hub + lawyers page"
```

---

### Task 6: Convert students, teachers, finance

**Files:**
- Modify: `frontend/src/app/use-cases/students/StudentsClient.tsx`
- Modify: `frontend/src/app/use-cases/teachers/TeachersClient.tsx`
- Modify: `frontend/src/app/use-cases/finance/FinanceClient.tsx`

- [ ] **Step 1: Read the reference.** Read the **converted** `LawyersClient.tsx` from Task 5 — it is the pattern. Read the three target files and each kit component's props.

- [ ] **Step 2: Convert each of the three files** following the exact pattern established in `LawyersClient.tsx`: keep the `"use client"` directive, imports, and all `t(...)` data assembly untouched; replace only the returned JSX with `MarketingShell` + kit composition. Map each page's sections to kit components by their role (hero → `EdPageHero`; prose narrative → `EdSection` + `EdProse`; feature lists → `EdFeatureList`; uniform card groups → `EdCardGrid`; 3-step rows → `EdStepRow`; FAQ → `EdFaqList`; closing → `EdCtaBanner`). Alternate `alt` backgrounds on `EdSection` so adjacent sections differ in tone. These pages are not byte-identical to lawyers — match section *roles*, not section *counts*. Drop `Header`/`Footer`/`ArticleMeta`/unused-icon imports. The breadcrumb's `useCases` + `current` labels come from each page's own `*.breadcrumb.*` keys.

- [ ] **Step 3: Verify.** `cd frontend && npm run build` must PASS. Open `/use-cases/students`, `/use-cases/teachers`, `/use-cases/finance` in a browser and confirm the editorial layout renders correctly on each.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/use-cases/
git commit -m "feat(marketing): editorial use-cases — students, teachers, finance"
```

---

### Task 7: Convert healthcare, compliance, consultants

**Files:**
- Modify: `frontend/src/app/use-cases/healthcare/HealthcareClient.tsx`
- Modify: `frontend/src/app/use-cases/compliance/ComplianceClient.tsx`
- Modify: `frontend/src/app/use-cases/consultants/ConsultantsClient.tsx`

- [ ] **Step 1: Read the reference.** Read the converted `LawyersClient.tsx` and the three target files and the kit component props.

- [ ] **Step 2: Convert each of the three files** following the Task 6 method exactly — same pattern, same mapping rules, same `alt` alternation, same import cleanup.

- [ ] **Step 3: Verify.** `cd frontend && npm run build` must PASS. Open `/use-cases/healthcare`, `/use-cases/compliance`, `/use-cases/consultants` and confirm.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/use-cases/
git commit -m "feat(marketing): editorial use-cases — healthcare, compliance, consultants"
```

---

### Task 8: Convert hr-contracts, real-estate

**Files:**
- Modify: `frontend/src/app/use-cases/hr-contracts/HrContractsClient.tsx`
- Modify: `frontend/src/app/use-cases/real-estate/RealEstateClient.tsx`

- [ ] **Step 1: Read the reference.** Read the converted `LawyersClient.tsx`, the two target files, and the kit component props.

- [ ] **Step 2: Convert both files** following the Task 6 method exactly.

- [ ] **Step 3: Verify.** `cd frontend && npm run build` must PASS. Open `/use-cases/hr-contracts` and `/use-cases/real-estate` and confirm. Then spot-check that the functional app UI is unaffected: open `/auth` and confirm it is visually unchanged (no editorial scope leak).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/use-cases/
git commit -m "feat(marketing): editorial use-cases — hr-contracts, real-estate"
```

---

## Self-review notes

- **Spec coverage:** Tasks 1–4 build the full kit named in the spec except `EdComparisonTable` (Plan B — used only by compare/alternatives, not use-cases). Tasks 5–8 convert all 10 use-cases pages + the hub.
- **Type consistency:** kit prop names are fixed in Tasks 1–4 and referenced unchanged in Tasks 5–8 (`items`, `steps`, `breadcrumb`, `primary`/`secondary`, `primaryCta`/`secondaryCta`, `icon`, `title`/`body`/`label`).
- **No fabricated copy:** every string comes from an existing `t(...)` key already present in the page; no new i18n keys are introduced. The only intentional content change is dropping the `ArticleMeta` byline, applied consistently.
