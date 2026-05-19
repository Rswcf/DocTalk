# Editorial Marketing — Plan B: Compare + Alternatives Families

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Extend the editorial marketing kit with a comparison table and three small list components, then re-skin the `compare/` and `alternatives/` page families (2 hubs + 10 detail pages).

**Architecture:** Same as Plan A — a shared kit in `frontend/src/components/marketing/`, thin per-page composition. Spec: `docs/superpowers/specs/2026-05-19-editorial-marketing-phase2-design.md`. Plan A is complete (kit + use-cases family); read a converted use-cases page (`frontend/src/app/use-cases/lawyers/LawyersClient.tsx`) for the established conversion pattern.

**Tech Stack:** Next.js 14 App Router, React, Tailwind, `editorial.css` scoped layer, lucide-react, `i18n` `useLocale()`.

**Conventions (every task):**
- New components render only `.dt-editorial`-scoped markup (the `MarketingShell` supplies the `dt-editorial` root — components must not add it).
- Use the editorial vocabulary: `ed-shell ed-rule ed-section ed-h1 ed-h2 ed-h3 ed-lede ed-body ed-label ed-label-num ed-caption ed-num ed-cta ed-link ed-card ed-crumb ed-prose ed-inline`.
- No `gray-*`/`indigo-*`/`violet-*`/`purple-*`, no glass/gradient/glow, no `dark:` variants. Colors from `--ed-*` variables / `ed-*` classes.
- `npm run build` must pass at the end of every task; commit at the end of every task.
- `page.tsx` server wrappers are never touched. `t(...)` keys are never changed; no new copy invented (the only intentional content change is dropping the old `ArticleMeta` byline).
- Pure presentational components omit `"use client"`; only interactive ones keep it.

---

### Task 1: EdComparisonTable + prose-list CSS

**Files:**
- Create: `frontend/src/components/marketing/EdComparisonTable.tsx`
- Modify: `frontend/src/app/editorial.css`

- [ ] **Step 1: Create `EdComparisonTable.tsx`** — an editorial re-skin of the existing `frontend/src/components/seo/ComparisonTable.tsx` (read that file first for the data shape and behavior).
  - `"use client"` (uses `useLocale` for cell aria-labels).
  - Props: `{ features: { name: string; doctalk: string | boolean; competitor: string | boolean }[]; competitorName: string }`.
  - Render a `<table>` (full width, `border-collapse`, `min-width: 480px` inside an `overflow-x-auto` wrapper for mobile).
  - No rounded corners, no shadow, no card chrome — instead: a `1px solid var(--ed-rule)` border around the table; hairline `1px solid var(--ed-rule)` row separators; no zebra striping.
  - Header row: `<th>` cells, mono uppercase labels via the `ed-label` class — column 1 = `t('billing.comparison.feature')`, column 2 = `DocTalk`, column 3 = `competitorName`. The DocTalk column header gets a subtle emphasis: background `var(--ed-paper-2)` and the label text in `var(--ed-signal)`. Column widths ~40% / 30% / 30%. `padding: 14px 18px`.
  - Body cells: feature name in column 1 (`ed-body`, `var(--ed-ink)`, medium weight); the DocTalk column cell has background `var(--ed-paper-2)`; cells `padding: 13px 18px`, center-aligned for the two value columns.
  - Cell value rendering (a `CellValue` sub-component): a boolean `true` → a mono check mark `✓` in `var(--ed-signal)` (e.g. an 18px `<span>` using `var(--font-plex-mono)`); boolean `false` → a mono en-dash `–` in `var(--ed-ink-3)`; the string `'Partial'` → a mono `~` glyph + the text `t('comparison.partial')` in `var(--ed-ochre)`; any other string → plain `ed-body` text. Booleans keep an `aria-label` of `t('common.yes')` / `t('common.no')` (read ComparisonTable.tsx — it does this).
  - The whole table is wrapped so it can sit inside an `EdSection`.

- [ ] **Step 2: Add prose-list CSS to `editorial.css`.** Several compare pages render bulleted "who should choose" lists inside prose. Append, before the final `.dt-editorial *:focus-visible` rule:

```css
/* Bulleted / ordered lists inside editorial prose. */
.dt-editorial .ed-prose ul {
  list-style: none;
  margin: 0 0 18px;
  padding: 0;
}
.dt-editorial .ed-prose ul li {
  position: relative;
  padding-left: 20px;
  font-size: 15.5px;
  line-height: 1.7;
  color: var(--ed-ink-2);
  margin-bottom: 8px;
}
.dt-editorial .ed-prose ul li::before {
  content: "";
  position: absolute;
  left: 2px;
  top: 11px;
  width: 5px;
  height: 5px;
  background: var(--ed-signal);
}
.dt-editorial .ed-prose ul li:last-child { margin-bottom: 0; }
```

- [ ] **Step 3:** Run `cd frontend && npm run build`. Expected: PASS.

- [ ] **Step 4: Commit** — `feat(marketing): editorial comparison table + prose lists`. Stage `frontend/src/components/marketing/` and `frontend/src/app/editorial.css`.

---

### Task 2: EdRelatedLinks + EdCheckList + EdChoiceList

**Files (all new in `frontend/src/components/marketing/`):**
- Create: `EdRelatedLinks.tsx`
- Create: `EdCheckList.tsx`
- Create: `EdChoiceList.tsx`

- [ ] **Step 1: Create `EdRelatedLinks.tsx`** — the "Related pages" link row that ends every compare/alternatives page.
  - Props: `{ title: string; links: { href: string; label: string }[] }`.
  - Renders a small block: a mono `ed-label` for `title`, then a `flex flex-wrap gap-x-5 gap-y-2` row of `<Link className="ed-link">` items (the editorial underlined text-link style). Not card chips — editorial pages use plain ruled text links. Margin-top ~16px between label and links.
  - This is meant to be placed inside an `<EdSection>` by the caller (or render standalone — keep it just the block, no `<section>`).

- [ ] **Step 2: Create `EdCheckList.tsx`** — a compact editorial advantages list (used for the "Key Advantages" list on the #1 entry of alternatives pages).
  - Props: `{ items: string[] }`.
  - Renders a `<ul>` (`list-style:none`, no padding) where each `<li>` is `flex items-baseline gap-2.5`: a mono `✓` glyph in `var(--ed-signal)` (`var(--font-plex-mono)`, ~12px) + the item text in `ed-body`. `margin-bottom: 7px` per item.

- [ ] **Step 3: Create `EdChoiceList.tsx`** — the "How to choose" need→pick rows on alternatives pages.
  - Props: `{ items: { need: string; pick: { label: string; href: string } }[] }`.
  - Renders a single column of hairline-ruled rows. Each row: `1px solid var(--ed-rule)` top border (every row), `flex items-baseline justify-between gap-6`, `padding: 14px 0`. Left: the `need` text in `ed-body`. Right: a `<Link className="ed-link">` for `pick.label → pick.href` (`white-space: nowrap`). The list gets a `1px solid var(--ed-rule)` bottom border on the last row.
  - Index-based keys.

- [ ] **Step 4:** Run `cd frontend && npm run build`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(marketing): editorial related-links, check-list, choice-list`. Stage `frontend/src/components/marketing/`.

---

### Task 3: Convert the compare hub + the chatpdf comparison (pilot)

**Files:**
- Modify: `frontend/src/app/compare/CompareHubClient.tsx`
- Modify: `frontend/src/app/compare/chatpdf/ChatpdfClient.tsx`

- [ ] **Step 1: Read** both files in full, plus every kit component (`MarketingShell`, `EdPageHero`, `EdSection`, `EdProse`, `EdFeatureList`, `EdCardGrid`, `EdFaqList`, `EdCtaBanner`, `EdComparisonTable`, `EdRelatedLinks`) and the converted reference `frontend/src/app/use-cases/lawyers/LawyersClient.tsx`.

- [ ] **Step 2: Convert `ChatpdfClient.tsx`.** Keep the `"use client"` directive, `useLocale` import, and the `features` and `faqItems` data blocks UNCHANGED. Replace only the returned JSX:
  - Root `<MarketingShell breadcrumb={[{label: t('compareChatpdf.breadcrumb.home'), href:'/'}, {label: t('compareChatpdf.breadcrumb.compare'), href:'/compare'}, {label: t('compareChatpdf.breadcrumb.current')}]}>`.
  - `<EdPageHero title={t('compareChatpdf.heroTitle')} lede={t('compareChatpdf.heroDescription')} primaryCta={{ label: t('compareChatpdf.related.freeDemo'), href:'/demo' }} />` — drop the old `ArticleMeta` byline. (No `icon` — compare pages had no hero icon.)
  - "Quick comparison" → `<EdSection title={t('compareChatpdf.quickComparison')}>` containing `<EdComparisonTable features={features} competitorName="ChatPDF" />`.
  - "What is DocTalk" → `<EdSection alt title={t('compareChatpdf.whatIsDocTalk')}>` + `<EdProse>` with the paragraph (keep the external `arxiv.org` RAG `<a>` link).
  - "What is ChatPDF" → `<EdSection title={t('compareChatpdf.whatIsChatPDF')}>` + `<EdProse>` (keep the external `chatpdf.com` `<a>` link).
  - "Feature-by-feature" → `<EdSection alt title={t('compareChatpdf.featureByFeature')}>` containing the six feature blocks as stacked `<h3 className="ed-h3">` + `<EdProse>` (two paragraphs each) per block — the same stacked pattern LawyersClient uses for "real-world". Keep all inline `<Link>`s; inside `EdProse` they need no class. Drop the lucide icons that decorated the old `<h3>`s (editorial sub-headings are text-only) — or, if you prefer, keep one small icon; default to dropping them and removing the now-unused icon imports.
  - "Who should choose DocTalk" → `<EdSection title={t('compareChatpdf.whoDocTalk')}>` + `<EdProse>` containing a `<ul>` of the five `whoDocTalk.itemN` `<li>`s (the `ed-prose ul` CSS from Task 1 styles it).
  - "Who should choose ChatPDF" → `<EdSection alt title={t('compareChatpdf.whoChatPDF')}>` + `<EdProse>` with a `<ul>` of the four `whoChatPDF.itemN` `<li>`s.
  - "Verdict" → `<EdSection title={t('compareChatpdf.verdict')}>` + `<EdProse>` (three paragraphs, keep the inline `/demo` `<Link>`).
  - "FAQ" → `<EdSection alt title={t('compareChatpdf.faqTitle')}>` + `<EdFaqList items={faqItems} />`.
  - "Related pages" → `<EdSection title={t('compareChatpdf.relatedPages')}>` containing `<EdRelatedLinks title={t('compareChatpdf.relatedPages')} links={[...the six related links...]} />` — OR pass the related links straight to `EdRelatedLinks` and skip the doubled title (use `EdRelatedLinks` directly inside a plain `<EdSection>` without a section `title`, so the title shows once). Choose the cleaner: a plain `<EdSection>` (no title) wrapping `<EdRelatedLinks title=... links=... />`.
  - Closing → `<EdCtaBanner title={t('compareChatpdf.ctaTitle')} description={t('compareChatpdf.ctaDescription')} primary={{ label: t('compareChatpdf.ctaButton'), href:'/demo' }} />` as the last child.
  - `alt` alternation: ensure adjacent `<EdSection>`s differ in tone all the way down.
  - Remove unused imports (`Header`, `Footer`, `ArticleMeta`, `ComparisonTable`, `FAQSection`, `CTABanner`, the decorative lucide icons). Add kit imports + `Link`.

- [ ] **Step 3: Convert `CompareHubClient.tsx`.** It is a hub: hero → grid of 5 comparison cards (each links to `/compare/<slug>`) → a "widen your search" link block → a closing prompt + button to `/alternatives`. Convert:
  - `<MarketingShell breadcrumb={[{label:'Home'→'/'}, {label: t('public.nav.compare') or the hub title, no href}]}>` — use an existing key for the crumb labels; for "Home" use `t('useCasesHub.breadcrumb.home')` if no compare-home key exists, otherwise the page's own. (Inspect the file for available keys; do not invent.)
  - `<EdPageHero title={t('compareHub.heroTitle')} lede={t('compareHub.heroDescription')} />`.
  - The 5 comparison cards → a clickable card grid. Use `<EdCardGrid columns={2} items={comparisons.map(c => ({ title: t('compareHub.vsLabel', {name:c.name}), body: t(c.taglineKey), href:`/compare/${c.slug}` }))} />` — `EdCardGrid` now supports an optional `href` per item (renders an anchor card). Wrap in an `<EdSection>`.
  - The "widen your search" block (`compareHub.widenTitle` / `widenDescription` + 5 links) → `<EdSection alt title={t('compareHub.widenTitle')}>` with a `<p className="ed-body">` for the description and an `<EdRelatedLinks>` (no title, or a small label) for the 5 links.
  - The closing prompt + "browse alternatives" button → `<EdCtaBanner description={t('compareHub.alternativesPrompt')} primary={{ label: t('compareHub.browseAlternatives'), href:'/alternatives' }} />` (no title — `EdCtaBanner.title` is optional).
  - Remove unused imports.

- [ ] **Step 4: Verify.** `cd frontend && npm run build` must PASS. Open `/compare` and `/compare/chatpdf` in a browser; confirm the editorial layout, the comparison table reads correctly, the FAQ works, no glass/gradient.

- [ ] **Step 5: Commit** — `feat(marketing): editorial compare hub + chatpdf comparison`. Stage `frontend/src/app/compare/`.

---

### Task 4: Convert the remaining compare pages

**Files:**
- Modify: `frontend/src/app/compare/askyourpdf/AskyourpdfClient.tsx`
- Modify: `frontend/src/app/compare/humata/HumataClient.tsx`
- Modify: `frontend/src/app/compare/notebooklm/NotebooklmClient.tsx`
- Modify: `frontend/src/app/compare/pdf-ai/PdfaiClient.tsx`

- [ ] **Step 1: Read** the converted `ChatpdfClient.tsx` from Task 3 — it is the exact pattern. Read the four target files and the kit components.

- [ ] **Step 2: Convert each of the four files** following the `ChatpdfClient.tsx` pattern exactly: keep `"use client"`, `useLocale`, and all `t(...)` data blocks (`features`/`quickCompare`, `faqItems`, related-link arrays) untouched; replace the returned JSX with the same `MarketingShell` + kit composition. These four pages have the same section roles as chatpdf (hero → comparison table → what-is pair → feature-by-feature → who-should-choose pair → verdict → FAQ → related links → CTA) but their i18n key prefixes differ (`compareAskyourpdf.*`, `compareHumata.*`, `compareNotebooklm.*`, `comparePdfai.*` — verify each file's actual prefix and key names; section counts may vary slightly — map by role, not by count). Each page's `competitorName` for `EdComparisonTable` is the competitor's display name (read it from the file's existing `<ComparisonTable competitorName=...>` call). Keep `alt` alternation. Drop the old chrome and decorative icons; remove unused imports.

- [ ] **Step 3: Verify.** `cd frontend && npm run build` must PASS. Open `/compare/askyourpdf`, `/compare/humata`, `/compare/notebooklm`, `/compare/pdf-ai` and confirm each.

- [ ] **Step 4: Commit** — `feat(marketing): editorial compare — askyourpdf, humata, notebooklm, pdf-ai`. Stage `frontend/src/app/compare/`.

---

### Task 5: Convert the alternatives hub + the chatpdf alternatives (pilot)

**Files:**
- Modify: `frontend/src/app/alternatives/AlternativesHubClient.tsx`
- Modify: `frontend/src/app/alternatives/chatpdf/ChatpdfAltsClient.tsx`

- [ ] **Step 1: Read** both files in full, the kit components, the `EdCheckList`/`EdChoiceList` components, and the converted `ChatpdfClient.tsx` (compare) for the established compare/alternatives conversion style.

- [ ] **Step 2: Convert `ChatpdfAltsClient.tsx`.** Keep `"use client"`, `useLocale`, the `quickCompare` and `faqItems` data blocks UNCHANGED. Replace the returned JSX:
  - Root `<MarketingShell breadcrumb={[home→'/', {label: t('altsChatpdf.breadcrumbAlternatives'), href:'/alternatives'}, {label: t('altsChatpdf.breadcrumbChatpdf')}]}>` (verify the exact breadcrumb key names in the file).
  - `<EdPageHero title={t('altsChatpdf.heroTitle')} lede={t('altsChatpdf.heroDescription')} primaryCta={{ label: t('altsChatpdf.linkFreeDemo'), href:'/demo' }} />` — drop `ArticleMeta`.
  - "Quick comparison" → `<EdSection title={t('altsChatpdf.compareTitle')}>` + `<EdComparisonTable features={quickCompare} competitorName="ChatPDF" />`.
  - The ranked entries #1–#7 → one `<EdSection>` per entry, each with the kit `EdSection` `num` prop carrying the two-digit rank (`"01"`…`"07"`) and `title` the entry title; `alt` alternates entry to entry. Entry content:
    - #1 (DocTalk): an `ed-label` eyebrow reading the "Best Overall" text (`t('altsChatpdf.bestOverall')`) in `var(--ed-signal)`; an `<EdProse>` with the three `alt1Desc*` paragraphs (keep the inline `/compare/chatpdf` `<Link>`); then a mono `ed-label` "Key Advantages" (`t('altsChatpdf.keyAdvantages')`) followed by `<EdCheckList items={[adv1..adv6]} />`.
    - #2–#7: an `<EdProse>` with the entry's two `descN*` paragraphs (keep inline compare `<Link>`s), then a `<p className="ed-body">` with a bold `t('altsChatpdf.bestFor')` label + the entry's `bestFor` text.
  - "How to choose" → `<EdSection title={t('altsChatpdf.chooseTitle')}>` with a `<p className="ed-body">` for `chooseDescription` then `<EdChoiceList items={[{need: t('altsChatpdf.chooseNeed1'), pick:{label:'DocTalk', href:'/demo'}}, …7 rows]} />` (the need/pick/href data is already assembled inline in the current file — reuse it).
  - "FAQ" → `<EdSection alt title={t('altsChatpdf.faqTitle')}>` + `<EdFaqList items={faqItems} />`.
  - "Related pages" → a plain `<EdSection>` wrapping `<EdRelatedLinks title={t('altsChatpdf.relatedPages')} links={[...the six related links...]} />`.
  - Closing → `<EdCtaBanner title={t('altsChatpdf.ctaTitle')} description={t('altsChatpdf.ctaDescription')} primary={{ label: t('altsChatpdf.ctaButton'), href:'/demo' }} />`.
  - `alt` alternation across all sections. Remove old chrome imports (`Header`, `Footer`, `ArticleMeta`, `ComparisonTable`, `FAQSection`, `CTABanner`, `Award`, `Check`) and add kit imports + `Link`.

- [ ] **Step 3: Convert `AlternativesHubClient.tsx`.** Hub: hero → grid of 5 alternative cards (each links `/alternatives/<slug>`, each shows a "N alternatives compared" count badge) → a "decision" link block → a closing prompt + button to `/compare`. Convert:
  - `<MarketingShell breadcrumb={[home→'/', {label: hub title, no href}]}>`.
  - `<EdPageHero title={t('altsHub.title')} lede={t('altsHub.subtitle')} />`.
  - The 5 cards → `<EdCardGrid columns={2} items={alternatives.map(a => ({ label: t('altsHub.alternativesCompared', {count:a.count}), title: t('altsHub.alternativesFor', {name:a.name}), body: a.tagline, href:`/alternatives/${a.slug}` }))} />` inside an `<EdSection>` — the `label` carries the count as the card's mono eyebrow.
  - The "decision" block → `<EdSection alt title={t('altsHub.decisionTitle')}>` with a `<p className="ed-body">` description + `<EdRelatedLinks>` for the 5 links.
  - Closing → `<EdCtaBanner description={t('altsHub.comparePrompt')} primary={{ label: t('altsHub.viewComparisons'), href:'/compare' }} />`.
  - Remove unused imports.

- [ ] **Step 4: Verify.** `cd frontend && npm run build` must PASS. Open `/alternatives` and `/alternatives/chatpdf`; confirm editorial layout, the ranked entries read well, `EdCheckList`/`EdChoiceList` render correctly.

- [ ] **Step 5: Commit** — `feat(marketing): editorial alternatives hub + chatpdf alternatives`. Stage `frontend/src/app/alternatives/`.

---

### Task 6: Convert the remaining alternatives pages

**Files:**
- Modify: `frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsClient.tsx`
- Modify: `frontend/src/app/alternatives/humata/HumataAltsClient.tsx`
- Modify: `frontend/src/app/alternatives/notebooklm/NotebooklmAltsClient.tsx`
- Modify: `frontend/src/app/alternatives/pdf-ai/PdfAiAltsClient.tsx`

- [ ] **Step 1: Read** the converted `ChatpdfAltsClient.tsx` from Task 5 — the exact pattern. Read the four target files and the kit components.

- [ ] **Step 2: Convert each of the four files** following the `ChatpdfAltsClient.tsx` pattern. Keep `"use client"`, `useLocale`, and all `t(...)` data blocks untouched. The four pages share the role structure (hero → comparison table → ranked entries → how-to-choose → FAQ → related links → CTA) but differ in i18n key prefix (`altsAskyourpdf.*`, `altsHumata.*`, `altsNotebooklm.*`, `altsPdfai.*` — verify each file's actual prefix), in the NUMBER of ranked entries (each hub lists a different count — 5, 6, or 7 — render exactly as many `<EdSection>` entries as the page has), and in whether a "Key Advantages" `EdCheckList` exists (only on the #1/DocTalk entry — include it only where the page has the advantages keys). Map by role; verify keys per file. Keep `alt` alternation. `competitorName` for `EdComparisonTable` from each file's existing call. Drop old chrome + decorative icons; remove unused imports.

- [ ] **Step 3: Verify.** `cd frontend && npm run build` must PASS. Open `/alternatives/askyourpdf`, `/alternatives/humata`, `/alternatives/notebooklm`, `/alternatives/pdf-ai` and confirm each.

- [ ] **Step 4: Commit** — `feat(marketing): editorial alternatives — askyourpdf, humata, notebooklm, pdf-ai`. Stage `frontend/src/app/alternatives/`.

---

## Self-review notes

- **Spec coverage:** Tasks 1–2 add the four components Plan B needs (`EdComparisonTable`, `EdRelatedLinks`, `EdCheckList`, `EdChoiceList`) + prose-list CSS. Tasks 3–6 convert all 12 compare/alternatives pages.
- **Type consistency:** kit prop names fixed in Tasks 1–2 and reused unchanged in 3–6 (`features`/`competitorName`, `links`, `items`, `need`/`pick`). `EdCardGrid` `href` support was added in Plan A's final commit.
- **No fabricated copy:** every string comes from an existing `t(...)` key in the page. The only intentional content change is dropping the `ArticleMeta` byline and the decorative sub-heading icons.
