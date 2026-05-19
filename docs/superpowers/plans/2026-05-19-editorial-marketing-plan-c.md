# Editorial Marketing — Plan C: Features + Tools Families

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Re-skin the `features/` family (hub + 5 pages) and the `tools/` family (hub + 2 interactive tools) into the editorial marketing layer, reusing the existing kit. No new kit components.

**Architecture:** Same as Plans A/B — `MarketingShell` + editorial kit composition. The features pages are pure marketing content (straight conversion). The two tools pages carry **functional interactive widgets** (a word counter, a reading-time calculator) — their page chrome is re-skinned to the editorial layer and the widget's visual styling is re-skinned to editorial tokens, but the widget's logic/state/handlers are preserved exactly. Spec: `docs/superpowers/specs/2026-05-19-editorial-marketing-phase2-design.md`. Plans A and B are complete (kit + use-cases + compare + alternatives). Reference conversions: `frontend/src/app/use-cases/lawyers/LawyersClient.tsx`, `frontend/src/app/compare/chatpdf/ChatpdfClient.tsx`.

**Tech Stack:** Next.js 14 App Router, React, Tailwind, `editorial.css` scoped layer, lucide-react, `i18n` `useLocale()`.

**Kit components available** (`frontend/src/components/marketing/`): `MarketingShell`, `EditorialMarketingHeader`, `EdPageHero`, `EdSection`, `EdProse`, `EdFeatureList`, `EdCardGrid` (optional `href`), `EdStepRow`, `EdFaqList`, `EdCtaBanner`, `EdComparisonTable`, `EdRelatedLinks`, `EdCheckList`, `EdChoiceList`. Editorial CSS classes (`.dt-editorial`-scoped): `ed-shell ed-rule ed-section ed-h1 ed-h2 ed-h3 ed-lede ed-body ed-label ed-label-num ed-caption ed-num ed-cta ed-link ed-card ed-crumb ed-prose ed-inline`.

**Conventions (every task):**
- `page.tsx` server wrappers are never touched. `t(...)` keys never changed; no new copy invented (intentional changes: dropping old `ArticleMeta` bylines, decorative hero badges/icons, and `dt-stitch-theme`/`dt-*` leftover root classes).
- Light-only, no `dark:` variants. No `gray-*`/`indigo-*`/`violet-*`/`purple-*`, no glass/gradient/glow. Colors from `--ed-*` variables / `ed-*` classes.
- Kit components render inside `MarketingShell`'s `dt-editorial` root — pages must not add `dt-editorial` themselves.
- `alt` alternation: adjacent `<EdSection>`s always differ in tone.
- `npm run build` must pass at the end of every task; commit at the end of every task.

---

### Task 1: Convert the features hub + the citations feature page (pilot)

**Files:**
- Modify: `frontend/src/app/features/FeaturesHubClient.tsx`
- Modify: `frontend/src/app/features/citations/CitationsClient.tsx`

- [ ] **Step 1: Read** both files in full, the kit components, `EdComparisonTable.tsx` (for the editorial table styling pattern), and the reference `frontend/src/app/use-cases/lawyers/LawyersClient.tsx`.

- [ ] **Step 2: Convert `CitationsClient.tsx`.** Keep `"use client"`, `useLocale`, and all data blocks (`howSteps`, `layers`, `comparisonRows`, `useCases`, `faqItems`) UNCHANGED. Replace the returned JSX:
  - Root `<MarketingShell breadcrumb={[{label:'Home', href:'/'}, {label: t('featuresHub.heroTitle') or a "Features" label, href:'/features'}, {label: t('featuresCitations.heroTitle')}]}>`. (The page has no breadcrumb keys of its own — use `t('useCasesHub.breadcrumb.home')` for Home, an existing short Features label for the middle crumb such as `t('footer.links.features')`, and the page hero title for the current crumb. Verify the keys exist; do not invent.)
  - `<EdPageHero title={t('featuresCitations.heroTitle')} lede={t('featuresCitations.heroSubtitle')} eyebrow={t('featuresCitations.heroBadge')} primaryCta={{ label: t('featuresCitations.heroCta'), href:'/demo' }} />` — the old pill "badge" becomes the hero `eyebrow`; drop the badge's lucide icon.
  - "How it works" → `<EdSection title={t('featuresCitations.howTitle')}>` with the `howSubtitle` as a `<p className="ed-lede">` then `<EdStepRow steps={howSteps.map(s => ({ title: s.title, body: s.description, icon: s.icon }))} />`.
  - "Why citations matter" → `<EdSection alt title={t('featuresCitations.whyTitle')}>` + `<EdProse>` with the four `whyParaN` paragraphs.
  - "Three layers" → `<EdSection title={t('featuresCitations.layersTitle')}>` with `layersSubtitle` as a `<p className="ed-lede">` then `<EdFeatureList items={layers.map(l => ({ title: l.title, body: l.description, icon: l.icon }))} />`.
  - "Citation quality compared" → `<EdSection alt title={t('featuresCitations.compTitle')}>` with `compSubtitle` as a `<p className="ed-lede">`. This is a 5-column comparison table (feature + DocTalk + ChatPDF + AskYourPDF + Humata) — `EdComparisonTable` is 3-column and does NOT fit. Render the table INLINE as an editorial table: READ `EdComparisonTable.tsx` and replicate its editorial styling (1px `var(--ed-rule)` border, hairline row separators, mono `ed-label` header cells, the DocTalk column emphasized with `var(--ed-paper-2)` background + `var(--ed-signal)` header text, `scope="col"`/`scope="row"`), but with 5 columns. The boolean/`'partial'` cell values render as the mono `✓` (signal) / `–` (ink-3) / `~`+partial-text (ochre) glyphs — reuse the exact glyph treatment from `EdComparisonTable`'s `CellValue`. Below the table keep the `compDisclaimer` text as a `<p className="ed-caption">`.
  - "Use cases" → `<EdSection title={t('featuresCitations.useCasesTitle')}>` with `useCasesSubtitle` as a `<p className="ed-lede">` then `<EdCardGrid columns={3} items={useCases.map(u => ({ title: u.title, body: u.description, icon: u.icon, href: u.link }))} />` (the use-case cards link out — `EdCardGrid` `href` makes them clickable; the old separate "linkText" link is absorbed into the clickable card).
  - "FAQ" → `<EdSection alt title={t('featuresCitations.faqTitle')}>` + `<EdFaqList items={faqItems.map(f => ({ question: f.q, answer: f.a }))} />`.
  - Closing → `<EdCtaBanner title={t('featuresCitations.ctaTitle')} description={t('featuresCitations.ctaSubtitle')} primary={{ label: t('featuresCitations.ctaDemoButton'), href:'/demo' }} secondary={{ label: t('featuresCitations.ctaFormatsButton'), href:'/features/multi-format' }} />`.
  - The old footer "internal links" row (4 links) → a plain `<EdSection>` wrapping `<EdRelatedLinks links={[the 4 links verbatim]} />` placed BEFORE the `EdCtaBanner`.
  - `alt` alternation across all sections. Remove unused imports (`Header`, `Footer`, `CheckCircle`, `XCircle`, `Minus` if the inline table uses glyphs instead, decorative icons). Keep lucide icons fed to `howSteps`/`layers`/`useCases`.

- [ ] **Step 3: Convert `FeaturesHubClient.tsx`.** Hub: hero (icon + title + subtitle) → 5-feature card grid (link `/features/<slug>`) → a "workflows" link block → a closing CTA. Keep `"use client"`, `useLocale`, `features` array. Convert:
  - `<MarketingShell breadcrumb={[{label: t('useCasesHub.breadcrumb.home'), href:'/'}, {label: t('featuresHub.heroTitle')}]}>`.
  - `<EdPageHero title={t('featuresHub.heroTitle')} lede={t('featuresHub.heroSubtitle')} />`.
  - 5 cards → `<EdSection>` + `<EdCardGrid columns={3} items={features.map(f => ({ title: f.title, body: f.description, icon: f.icon, href: `/features/${f.slug}` }))} />`.
  - "Workflows" block → `<EdSection alt title={t('featuresHub.workflowsTitle')}>` with `<p className="ed-body">` for `workflowsDesc` + `<EdRelatedLinks links={[the 5 workflow links verbatim]} />`.
  - Closing → `<EdCtaBanner description={t('featuresHub.ctaText')} primary={{ label: t('featuresHub.ctaButton'), href:'/demo' }} />`.
  - Remove unused imports.

- [ ] **Step 4: Verify.** `cd frontend && npm run build` must PASS. Open `/features` and `/features/citations`; confirm editorial layout, the 5-column table reads correctly, FAQ works.

- [ ] **Step 5: Commit** — `feat(marketing): editorial features hub + citations page`. Stage `frontend/src/app/features/`.

---

### Task 2: Convert the remaining feature pages

**Files:**
- Modify: `frontend/src/app/features/free-demo/FreeDemoClient.tsx`
- Modify: `frontend/src/app/features/multi-format/MultiFormatClient.tsx`
- Modify: `frontend/src/app/features/multilingual/MultilingualClient.tsx`
- Modify: `frontend/src/app/features/performance-modes/PerformanceModesClient.tsx`

- [ ] **Step 1: Read** the converted `CitationsClient.tsx` from Task 1 (the pattern), the four target files, and the kit components.

- [ ] **Step 2: Convert each of the four files** following the `CitationsClient.tsx` pattern. Keep `"use client"`, `useLocale`, and all `t(...)` data blocks UNCHANGED; replace only the returned JSX. These four pages share the features-page role vocabulary (hero → how-it-works steps → narrative prose → explainer grids/lists → optional comparison/format table → use-case or related cards → FAQ → CTA) but their section sets and i18n key prefixes differ (`featuresFreeDemo.*`, `featuresMultiFormat.*`, `featuresMultilingual.*`, `featuresPerformanceModes.*` — verify each by reading). Map sections to the kit by ROLE:
  - hero → `<EdPageHero>` (pill badge → `eyebrow`; drop decorative icons).
  - step rows → `<EdStepRow>`.
  - narrative prose → `<EdSection>` + `<EdProse>` (keep inline `<Link>`/`<a>`).
  - icon+title+description card groups → `<EdCardGrid>` (with `href` if the cards link out) or `<EdFeatureList>` (numbered) — pick whichever fits the content (uniform tiles → `EdCardGrid`; a ranked/numbered explainer → `EdFeatureList`).
  - any small comparison/format table → an inline editorial table styled like `EdComparisonTable` (hairline, mono header, signal-emphasized DocTalk column), OR `<EdComparisonTable>` if it is genuinely a 3-column DocTalk-vs-one-competitor table.
  - FAQ → `<EdFaqList>`. closing → `<EdCtaBanner>`. trailing internal-link rows → `<EdRelatedLinks>` in a plain `<EdSection>`.
  - `alt` alternation across all sections.
  - Drop old chrome (`Header`, `Footer`, `ArticleMeta`, decorative icons); remove unused imports; add kit imports + `Link`.

- [ ] **Step 3: Verify.** `cd frontend && npm run build` must PASS. Open `/features/free-demo`, `/features/multi-format`, `/features/multilingual`, `/features/performance-modes` and confirm each.

- [ ] **Step 4: Commit** — `feat(marketing): editorial features — free-demo, multi-format, multilingual, performance-modes`. Stage `frontend/src/app/features/`.

---

### Task 3: Convert the tools hub + the two interactive tools

The two tool pages carry **functional widgets**. The widget logic (state, `useMemo`, handlers, the text-analysis helper functions, the sample text) MUST be preserved byte-for-byte. Only the page chrome and the widget's *visual styling* (Tailwind class names / inline styles) are re-skinned to editorial tokens.

**Files:**
- Modify: `frontend/src/app/tools/ToolsHubClient.tsx`
- Modify: `frontend/src/app/tools/word-counter/WordCounterClient.tsx`
- Modify: `frontend/src/app/tools/reading-time/ReadingTimeClient.tsx`

- [ ] **Step 1: Read** all three files in full, the kit components, and the converted `CitationsClient.tsx`. Note: these three files use HARDCODED English (no `useLocale`/`t()`) — keep the English copy verbatim; do not add i18n.

- [ ] **Step 2: Convert `ToolsHubClient.tsx`.** A simple hub. Convert to `<MarketingShell breadcrumb={[{label:'Home', href:'/'}, {label:'Tools'}]}>` + `<EdPageHero title={...} lede={...} eyebrow="Free utilities" />` (the hardcoded hero copy is kept verbatim; the side "proof points" panel can become a small mono list or be dropped — prefer keeping it as a compact `<EdCheckList>` of the three proof-point labels, or an `ed-caption` list). The 2 tool cards → `<EdSection>` + `<EdCardGrid columns={2} items={[…the 2 tools with title/description/icon/href:`/tools/<slug>`…]} />`. The "need cited answers" CTA block → `<EdCtaBanner title="Need cited answers from the original file?" description={…} primary={{label:'Try the Free Demo', href:'/demo'}} secondary={{label:'Explore features', href:'/features'}} />`. The trailing related-links row → `<EdRelatedLinks links={[…verbatim]} />` in a plain `<EdSection>` before the CTA. Remove the `dt-stitch-theme` root class and old chrome imports.

- [ ] **Step 3: Convert `WordCounterClient.tsx`.** Keep ALL of the top-of-file helper functions (`getWords`, `getSentences`, `getParagraphs`, `getCharCountNoSpaces`, `getAverageWordLength`, `getTopWords`, `formatTime`), the `sampleText` const, and the component's `useState`/`useMemo`/`handleCopy` logic EXACTLY as they are. Replace the returned JSX:
  - Root `<MarketingShell breadcrumb={[{label:'Home', href:'/'}, {label:'Tools', href:'/tools'}, {label:'Word Counter'}]}>` (removes the `dt-stitch-theme` root + the manual breadcrumb nav + `Header`/`Footer`).
  - Hero → `<EdPageHero icon={LetterText} title="Free Document Word Counter" lede={…the existing subtitle…} />`.
  - The tool itself → inside a plain `<EdSection>`: the `<textarea>`, the Sample/Clear buttons, the Statistics panel, the Reading-Time panel, the Top-Words grid, the three summary tiles. RE-SKIN every element's styling to editorial tokens — keep the structure and all handlers/props, but change the visual classes:
    - panels/cards: `1px solid var(--ed-rule)` border, `var(--ed-paper-2)` background (or paper), no rounded-xl (use a 3px or 0 radius — match the editorial flat look), no shadow.
    - the `<textarea>`: `1px solid var(--ed-rule)` border, paper background, editorial focus ring (the global `.dt-editorial *:focus-visible` handles focus — but a textarea needs a visible border; keep `:focus` simple).
    - stat labels → `ed-label` or `ed-caption` (mono); stat values → a Newsreader/`ed-num`-style or `ed-body` semibold with `tabular-nums`.
    - section sub-headings ("Statistics", "Estimated Reading Time", "Top 10…") → `ed-h3` or mono `ed-label`.
    - buttons (Sample / Clear / Copy) → editorial text-button styling (mono or `ed-link`-like; the signal color for the primary action). No blue/`accent` classes — use `var(--ed-signal)` / `var(--ed-ink-*)`.
    - the "Need to analyze a PDF" CTA block → `<EdCtaBanner>` or an inline `ed-card`-style panel; prefer `<EdCtaBanner title="Need to analyze a PDF or DOCX file?" description={…} primary={{label:'Try DocTalk Free', href:'/demo'}} />` placed after the tool.
  - The "How to Use" SEO prose → `<EdSection title="How to Use This Word Counter">` + `<EdProse>` (keep the `<strong>`s and the inline `/demo` `<Link>`).
  - The trailing related-links row → `<EdRelatedLinks links={[…verbatim]} />` in a plain `<EdSection>`.
  - Remove old chrome imports; keep the lucide icons the widget uses.
  - **Verify the widget still works**: the word count updates as you type, Sample fills the textarea, Clear empties it, Copy copies the summary.

- [ ] **Step 4: Convert `ReadingTimeClient.tsx`** the same way: preserve ALL widget logic/state/handlers/helpers; re-skin the chrome (`MarketingShell` + `EdPageHero` + breadcrumb) and the widget's visual styling to editorial tokens; SEO prose → `EdSection`+`EdProse`; trailing links → `EdRelatedLinks`; closing → `EdCtaBanner`. Remove the `dt-stitch-theme` root class and old chrome imports.

- [ ] **Step 5: Verify.** `cd frontend && npm run build` must PASS. Open `/tools`, `/tools/word-counter`, `/tools/reading-time`; exercise BOTH widgets (type text, use the controls) and confirm they compute correctly and look editorial.

- [ ] **Step 6: Commit** — `feat(marketing): editorial tools hub + word-counter + reading-time`. Stage `frontend/src/app/tools/`.

---

## Self-review notes

- **Spec coverage:** Tasks 1–2 convert the features hub + 5 feature pages; Task 3 converts the tools hub + 2 tools. No new kit components — the existing kit covers features; the citations 5-column table is a one-off inline editorial table; the tools widgets are restyled in place.
- **Tools widget integrity:** Task 3 is explicit that all widget logic/helpers/state are preserved byte-for-byte — only visual styling changes. A verification step exercises both widgets.
- **No fabricated copy:** every string comes from an existing `t(...)` key or the pages' pre-existing hardcoded English. Intentional removals: `ArticleMeta` bylines, decorative hero badges/icons, `dt-stitch-theme` leftover root classes.
