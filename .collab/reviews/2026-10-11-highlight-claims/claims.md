# Citation-highlight claims audit — 2026-10-11 (Phase 1, audit only)

Branch `content/highlight-claims-pdf-txt` off `origin/main` @ `e7152bd6`. Nothing below is applied yet.

**Conclusion.** The copy must say: the cited passage is highlighted in **PDF and TXT** files; in MD, DOCX, PPTX,
XLSX and URL sources a citation jumps to the location without a passage highlight. That conclusion of site-test
F21 holds. F21's evidence did not cover the production path for DOCX and PPTX (see "Product truth"), but that path
also shows no passage highlight, for a different reason.

## Counts

| | hits | overclaims | to edit now |
|---|---|---|---|
| Locale keys (EN values, `compare*`/`alts*` excluded) | 95 | 25 | 25 keys + 1 key that gets the limit sentence = **26 keys × 11 locales** |
| Hardcoded TSX strings (user-visible) | 17 | 4 | 4 |
| `frontend/public/llms.txt` | 3 | 1 | 1 |
| Blog posts in scope (16 files) | 119 | 31 | 31, in 9 files |
| Frozen blog posts (3 files, queued for 11-07) | 42 | 11 | 0 |
| `ai-pdf-readers-page-number-citations-2026.md` (11-21 read) | 14 | 0 | 0 |
| **Total** | **290** | **72** | **61 edits + 1 added sentence** |

Files to edit in Phase 2: **25** — 11 locale JSONs, 4 TSX files, `llms.txt`, 9 blog posts.

All 26 keys exist, translated, in all 11 locale files: **286 values** to change in Phase 2 (checked by script).

Surfaces with **zero user-visible hits** (only code comments matched): `/pricing`, `/trust`, `/about` and `/demo`
page components, `/tools` page components (their locale keys are listed in table A), the marketing header and the
rest of `components/marketing/*`, `app/[locale]/*`, and every `*JsonLd.tsx` file except layout-translation (which
only matched "visual context"). JSON-LD text comes from the locale keys in table A.

Search terms: highlight / highlighted / highlighting, "exact passage", "exact source", "real-time citation",
visual, overlay, "every citation", "any citation", plus snippet, yellow, "bounding box" (highlight mechanism).
Code identifiers and comments (`CTABanner` `variant='highlight'`, `CitationField.tsx` comments, `chrome.ts` types,
in-app components) are not counted. Key lookups in TSX (`t('…')`) are counted once, under their key.

## Product truth (code evidence)

| Source | Viewer | Passage highlight | Evidence |
|---|---|---|---|
| PDF | `PdfViewer`, bbox overlay | **yes** | `DocumentReaderPageClient.tsx:410-427`; `PageWithHighlights.tsx:62-114` |
| TXT | `TextViewer` → `PlainTextContent` | **yes** (amber span) | `TextViewer.tsx:34-35` (txt not markdown), `:401-412`, `:672-681` |
| MD, XLSX | `TextViewer` → `MarkdownContent` | no — "Page N" caption only | `TextViewer.tsx:34-35`, `:394-400`, `:737-752` (I25 comment) |
| URL | `TextViewer` → `WebArticleView` → `MarkdownContent` | no — caption only | `TextViewer.tsx:141-153`, `:576-582` |
| DOCX, PPTX, text view | `TextViewer` → `MarkdownContent` | no — caption only | `TextViewer.tsx:34-35` |
| DOCX, PPTX, **slide view (default in production)** | `PdfViewer` on the LibreOffice-converted PDF | no — small margin marker at the page's top-left corner (static trace, see below) | `DocumentReaderPageClient.tsx:50` (`viewMode` default `'slide'`), `:175`, `:436`; `conversion_service.py:12`; `parse_worker.py:638-653`; `backend/Dockerfile:31-33` |

**What contradicted F21 (mechanism only, not the conclusion).**
1. F21 was measured on the isolated local stack (`.collab/reviews/2026-09-23-site-test/report.md:14-19`). That
   machine has no LibreOffice (`which libreoffice soffice` → not found), so DOCX/PPTX conversion failed silently and
   the reader fell back to `TextViewer`. In production the image ships LibreOffice, so DOCX and PPTX open in the
   converted-PDF slide view, not in `TextViewer`. F21 did not exercise that path.
2. The slide view has a designed text-snippet highlight (commit `55f3cfc0`, and strategy ③ in
   `.claude/rules/frontend.md` "PDF & Documents"). It never fires:
   - `PageWithHighlights.tsx:65` and `pdfEvidence.ts:12` treat only an exact `(0,0,1,1)` box as "dummy".
   - The backend writes the non-PDF block bbox in unit coordinates (`parse_worker.py:494`, `:502`) but sets the page
     to 612 × 792 pt (`parse_worker.py:509`) and `_normalize_bbox` divides by points (`parse_service.py:546-547`,
     `:964-990`). The box arrives as about `(0, 0, 0.0016, 0.0013)`.
   - So the snippet fallback is skipped, and `findEvidenceRange` rejects a focus-sentence match because it does not
     overlap that tiny region (`pdfEvidence.ts:83`).
   - Simulation with the real `pdfEvidence.ts` module: `dummyDetected:false`, one tiny region, `focusMatch:null`
     (the same text matches when no region is passed).
   - The 612 default was already in `parse_worker.py` at `55f3cfc0` (line 129), so the fallback was probably never
     live.
   - **Static trace and simulation only.** Not checked at runtime: no LibreOffice locally, and no production DOCX test.
3. Side finding, also static: DOCX "pages" are heading sections or ~3,000-character splits (`docx_extractor.py:39`),
   but the slide view jumps to page N of the converted PDF. For DOCX in slide view the jump can land on the wrong
   page. This touches the "click a citation to jump to the source" wording, which the brief treats as true for all
   formats. Not verified.

The copy rule therefore stays **PDF + TXT**. Items 2 and 3 are product bugs for a separate task, not copy.

## Verdict rules used

- `overclaim`: says or implies every/any citation highlights; couples highlighting with formats beyond PDF/TXT
  (same sentence, same list, same table, or on `/features/multi-format`); promises a highlight for MD/DOCX/PPTX/XLSX/URL.
- `ok`: jump/link wording ("click a citation to jump to the source"); a highlight claim in a clearly PDF context
  (the three demo documents are PDFs, `backend/seed_data/*.pdf`; academic papers; "CJK PDF" sections); feature names
  and link anchors ("Citation Highlighting"); unrelated senses of the word (a report's "highlights", "visual
  context", "yellow flag").
- Qualifier: "in PDF and text files". Where a qualifier would read badly, the highlight verb is replaced with
  jump/link wording instead. No new claims.

## A. Locale keys (EN value; other 10 locales follow)

Proposed values are full EN values. Leading/trailing whitespace is kept (`p2post`/`p3post` start with a space).

| # | key | current EN (relevant clause) | verdict | proposed EN value |
|---|---|---|---|---|
| A1 | `landing.description` (hero lede + HomeJsonLd descriptions) | "Drop a PDF, DOCX, or URL. Get answers with the exact page highlighted — one click to verify." | overclaim — couples highlight with DOCX/URL | `Drop a PDF, DOCX, or URL. Get answers with the exact page cited — one click to verify.` |
| A2 | `landing.metaDescription` | same text | overclaim — same | `Drop a PDF, DOCX, or URL. Get answers with the exact page cited — one click to verify.` |
| A3 | `landing.feature.citations.desc` | "Click one and the passage highlights on screen" | overclaim — landing lists 7 formats | `Numbered citations link to the exact page. Click one and, in PDF and text files, the passage highlights on screen — verify without losing your place.` |
| A4 | `landing.faq.a1` (also FAQPage JSON-LD) | "Click any citation to jump to the source and see it highlighted." | overclaim — any citation | `Every answer includes numbered citations that link to the exact passage in your document. Click any citation to jump to the source; in PDF and text files, you also see it highlighted. You always verify the AI's work yourself.` |
| A5 | `landing.frame.description` | "…the cited sentence is highlighted on that page." | ok — the Alphabet earnings PDF | — |
| A6 | `landing.proof.citations` | "Answers cite exact source passages" | ok — citation, no highlight; key not rendered | — |
| A7 | `landing.feature.layoutTranslation.desc` | "…visual context." | ok — unrelated | — |
| A8 | `blog.post.aboutDescription` (box on every post) | "…source citations that highlight in your original text. Supports PDF, DOCX, PPTX, XLSX…" | overclaim — couples with formats | `DocTalk is an AI-powered document chat app. Upload any document and get instant answers with source citations that link back to your original text. Supports PDF, DOCX, PPTX, XLSX, and more in 11 languages.` |
| A9 | `about.trust.paragraph1` | "supports citation highlighting, multiple performance modes, and document workflows across several formats" | ok — feature list, highlight not tied to formats | — |
| A10 | `home.explore.cards.citations.title` | "Citation Highlighting" | ok — feature name; key not rendered | — |
| A11 | `home.explore.cards.citations.description` | "links back to the exact source passage" | ok — link wording; key not rendered | — |
| A12 | `footer.links.citationHighlighting` | "Citation Highlighting" | ok — link label | — |
| A13 | `blog.category.related.citationHighlighting` | "Citation highlighting" | ok — link label | — |
| A14 | `useCasesHub.crossLinks.citationHighlighting` | "Citation highlighting" | ok — link label | — |
| A15 | `featuresPerformance.cta.linkCitations` | "Citation Highlighting" | ok — link label | — |
| A16 | `featuresMultiFormat.linkCitations` | "Citation Highlighting" | ok — link label | — |
| A17 | `toolsHub.relatedCitations` | "Citation Highlighting" | ok — link label | — |
| A18 | `featuresHub.citationsTitle` | "Citation Highlighting" | ok — feature name | — |
| A19 | `featuresHub.citationsDesc` | "Click any citation to jump to the exact source text, highlighted in your document." | overclaim — any citation | `Every AI answer includes numbered citations. Click any citation to jump to the exact source text, highlighted in PDF and text files.` |
| A20 | `featuresHub.layoutTranslationDesc` | "…visual context." | ok — unrelated | — |
| A21 | `featuresLayoutTranslation.heroSubtitle` | "…visual context." | ok — unrelated | — |
| A22 | `featuresLayoutTranslation.metaDescription` | "…visual context." | ok — unrelated | — |
| A23 | `featuresCitations.heroTitle` | "Source Citations with Real-Time Highlighting" | ok — generic, no every/format; page gets the limit sentence | — |
| A24 | `featuresCitations.metaTitle` | same | ok — listed only (metaTitle is never changed) | — |
| A25 | `featuresCitations.heroSubtitle` (lede + Article/SoftwareApplication JSON-LD) | "Click any citation to scroll to the source and see it highlighted." | overclaim — any citation | `Every answer DocTalk generates includes numbered citations that link directly to the original text in your document. Click any citation to scroll to the source; in PDF and text files, you also see it highlighted. No more guessing whether the AI got it right.` |
| A26 | `featuresCitations.metaDescription` | same text | overclaim — same | same as A25 |
| A27 | `featuresCitations.heroCta` | "Try Citation Highlighting" | ok — CTA to the PDF demo | — |
| A28 | `featuresCitations.howTitle` | "How Citation Highlighting Works" | ok — heading | — |
| A29 | `featuresCitations.howStep3Title` (HowTo step name) | "Click any citation to see the source highlighted" | overclaim — any citation | `Click any citation to jump to the source` |
| A30 | `featuresCitations.howStep3Desc` (HowTo step text) | "The passage is highlighted in yellow…" | overclaim — unconditional | `Click a citation number and the document viewer instantly scrolls to the exact source text. In PDF and text files, the passage is highlighted in yellow so you can read the original context and verify the AI's claim yourself.` |
| A31 | `featuresCitations.whyPara3` | "Every click takes you to the exact passage in the original document, highlighted so you can read it in context." | overclaim — every click | `DocTalk solves this with a citation-first approach. Every answer comes with numbered source references. Every reference is clickable. Every click takes you to the exact passage in the original document; in PDF and text files, it is highlighted so you can read it in context. The AI does not just tell you the answer — it shows you where the answer comes from.` |
| A32 | `featuresCitations.layer3Title` | "Layer 3: Visual Highlighting Navigation" | ok — heading; body (A33) states the limit | — |
| A33 | `featuresCitations.layer3Desc` — **gets the limit sentence** | "For DOCX, PPTX, and other text-based formats, it uses progressive text-snippet matching to locate and highlight the passage." | overclaim — names DOCX/PPTX | `The final layer is the interactive highlight experience. Click any citation and the document viewer scrolls to the source passage. For PDFs, this uses bounding box coordinates to highlight the exact text region on the page. For text files, it uses progressive text-snippet matching to locate and highlight the passage. Highlighting works in PDF and text files; in other formats, a citation jumps to the cited location.` |
| A34 | `featuresCitations.compClickHighlight` | "Click-to-highlight navigation" (DocTalk ✓) | ok — feature exists; page states the limit | — |
| A35 | `featuresCitations.compBboxHighlight` | "Bounding box highlighting (PDF)" | ok — PDF | — |
| A36 | `featuresCitations.compTextSnippet` | "Text-snippet matching (DOCX/PPTX)" (DocTalk ✓) | overclaim — implies a DOCX/PPTX highlight next to the PDF row | `Text-snippet highlighting (text files)` |
| A37 | `featuresCitations.useCasesSubtitle` | "Citation highlighting is not a nice-to-have." | ok — generic | — |
| A38 | `featuresCitations.useCaseFinanceDesc` | "Click any citation to jump to the exact table…" | ok — jump wording ("exact" hit) | — |
| A39 | `featuresCitations.faq1A` | "click any citation to verify it yourself" | ok — verify via jump | — |
| A40 | `featuresCitations.faq2A` | "Clicking it scrolls … and highlights it in yellow … For other formats, it uses text-snippet matching." | overclaim — every citation; "other formats" | `Yes. Every numbered citation in an AI answer is clickable. Clicking it scrolls the document viewer to the exact source passage; in PDF and text files, it also highlights it in yellow so you can read the original text in context. For PDFs, this highlights the bounding box region on the page. For text files, it uses text-snippet matching.` |
| A41 | `featuresCitations.faq3A` (Q: "Does it work with DOCX and PPTX?") | "Yes. Citation highlighting works across all 7 supported formats…" | overclaim — false | `Yes. Citation navigation works across all 7 supported formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and URLs. The passage itself is highlighted in PDF and text files — PDF uses bounding box coordinates, while text files use progressive text-snippet matching. In the other formats, a citation jumps to the cited location.` |
| A42 | `featuresCitations.faq5A` | "Citation highlighting is available on all plans" | ok — plan availability | — |
| A43 | `featuresCitations.ctaSubtitle` | "experience citation highlighting yourself" | ok — demo CTA (PDF demo) | — |
| A44 | `featuresMultiFormat.formatPdfDesc` | "bounding box highlighting" | ok — PDF | — |
| A45 | `featuresMultiFormat.formatUrlDesc` | "…using the same citation and highlighting features." | overclaim — URL highlight | `Web page content extraction and analysis. Paste any URL and chat with the page content using the same citation features.` |
| A46 | `featuresMultiFormat.detailPdfText` | "Bounding box citation highlighting…" | ok — PDF | — |
| A47 | `featuresMultiFormat.compCitationHighlight` | "Citation highlighting" row in the per-format table | overclaim — format table | `Citation highlighting (PDF and text files)` |
| A48 | `featuresMultiFormat.faq2A` | "Slide-level citations work with the same click-to-highlight feature as other formats." | overclaim — PPTX | `Yes. Upload any .pptx file and DocTalk extracts both slide content and speaker notes. Citations reference specific slides so you can navigate directly to the source.` (last sentence deleted) |
| A49 | `featuresMultiFormat.faq4A` | "…with the same citation highlighting feature as any uploaded document." | overclaim — URL | `Yes. Paste any URL and DocTalk extracts the web page content automatically. The extracted text is then available for AI chat with the same clickable citations as any uploaded document.` |
| A50 | `featuresMultiFormat.howStep3Desc` — **not a hit; gets the limit sentence** | "…and lets you click to verify each one." | add limit | `Ask any question in the chat panel. The AI searches the extracted content, generates an answer with numbered citations, and lets you click to verify each one. Highlighting works in PDF and text files; in other formats, a citation jumps to the cited location.` |
| A51 | `featuresMultilingual.cjk.p3` | "…see it highlighted on the page." | ok — section "CJK PDF Support" | — |
| A52 | `featuresMultilingual.faq.a2` | "Citation highlighting … work natively with CJK text" | ok — PDF encoding context | — |
| A53 | `featuresDemo.hero.subtitle` | "See citation highlighting … with 3 demo documents" | ok — demo PDFs | — |
| A54 | `featuresDemo.metaDescription` | same | ok — demo PDFs | — |
| A55 | `featuresDemo.docs.doc1.description` | "A real PDF … citation highlighting" | ok — PDF | — |
| A56 | `featuresDemo.whatYouGet.item1.description` | "test citation highlighting" | ok — demo PDFs | — |
| A57 | `featuresDemo.whatYouGet.item2.label` | "Citation highlighting" | ok — demo | — |
| A58 | `featuresDemo.compare.citationHighlighting` | "Citation highlighting" (all plans ✓) | ok — plan table | — |
| A59 | `featuresDemo.steps.step4.description` | "Click any numbered citation to jump to the highlighted source text." | ok — demo PDFs | — |
| A60 | `featuresDemo.cta.linkCitations` | "Citation Highlighting" | ok — link label | — |
| A61 | `demo.hint` (`/demo`) | "…see highlights" | ok — demo PDFs | — |
| A62 | `useCasesFinance.whyCitations.p2link` | "citation highlighting" | ok — anchor | — |
| A63 | `useCasesFinance.whyCitations.p2post` | "Click a citation, and the document viewer scrolls to the exact source text and highlights it. You see the original table…" | overclaim — every claim; tables/XLSX | ` ensures that every number, every claim, and every summary is traceable to a specific passage in the original document. Click a citation, and the document viewer scrolls to the exact source text; in PDF and text files, it also highlights it. You see the original table, the original footnote, the original paragraph. No guessing, no trust required.` |
| A64 | `useCasesFinance.cta.description` | "See how AI-powered citation highlighting works on real reports." | ok — demo CTA | — |
| A65 | `useCasesLawyers.whyCitations.p3link` | "citation highlighting system" | ok — anchor | — |
| A66 | `useCasesLawyers.whyCitations.p3post` | "Click a citation, and the document viewer scrolls to the exact text and highlights it." | overclaim — every answer; contracts are often DOCX | ` addresses this directly. Every AI answer includes numbered citations that link to specific passages in your uploaded document. Click a citation, and the document viewer scrolls to the exact text; in PDF and text files, it also highlights it. The AI cannot fabricate what is not in your document, because its answers are grounded in the actual text through Retrieval-Augmented Generation.` |
| A67 | `useCasesLawyers.steps.verify.description` | "Click any citation number … The source text is highlighted…" | overclaim — any citation | `Click any citation number to jump to the exact clause in the document. In PDF and text files, the source text is highlighted so you can read the original language and confirm the AI's extraction.` |
| A68 | `useCasesLawyers.cta.description` | "citation highlighting works on real documents" | ok — demo CTA | — |
| A69 | `useCasesStudents.citations.link` | "citation highlighting system" | ok — anchor | — |
| A70 | `useCasesStudents.citations.p2b` | "Click the citation, and the document viewer scrolls to the exact text and highlights it." | overclaim — page lists DOCX theses, PPTX slides | `solves this by grounding every AI answer in your actual document text. Each numbered citation corresponds to a specific passage in your uploaded paper. Click the citation, and the document viewer scrolls to the exact text; in PDF and text files, it also highlights it.` |
| A71 | `useCasesStudents.multilingual.p3` | "When DocTalk cites a passage from a Japanese paper, clicking the citation highlights the original Japanese text" | overclaim — page lists DOCX/PPTX/URL | `The citation system works across languages. When DocTalk cites a passage from a Japanese PDF, clicking the citation highlights the original Japanese text in the document viewer. You can verify the AI's interpretation against the source, even if you are not fully fluent in the document's language.` |
| A72 | `useCasesStudents.getStarted.step3.description` | "Click any numbered citation … scrolls to the exact source passage and highlights it" | overclaim — any; step 1 lists PDF/DOCX/PPTX/URL | `Click any numbered citation in the AI answer. The document viewer scrolls to the exact source passage, highlighted in PDF and text files, so you can verify the claim before using it in your work.` |
| A73 | `useCasesStudents.cta.description` | "citation highlighting works on real papers" | ok — demo CTA | — |
| A74 | `useCasesHr.cta.description` | "citation highlighting works" | ok — demo CTA | — |
| A75 | `useCasesHealthcare.challenge.p4` | "citations to the exact passage" | ok — citation wording | — |
| A76 | `useCasesHealthcare.whyCitations.p2` | "link directly to the exact passage … click a citation to jump to…" | ok — jump wording | — |
| A77 | `useCasesHealthcare.whyCitations.p4link1` | "citation highlighting" | ok — anchor | — |
| A78 | `useCasesHealthcare.steps.cited.description` | "Click any citation to jump to the exact section" | ok — jump | — |
| A79 | `useCasesTeachers.whyCitations.p1` | "link to the exact passage" | ok — link | — |
| A80 | `useCasesTeachers.whyCitations.p3link` | "citation highlighting" | ok — anchor | — |
| A81 | `useCasesTeachers.steps.cited.description` | "Click any citation to jump to the exact passage" | ok — jump | — |
| A82 | `useCasesTeachers.faq.q2.answer` | "citations pointing to the exact source text" | ok — citation | — |
| A83 | `useCasesTeachers.challenge.p3post` | "highlight how AI tools are helping educators" | ok — unrelated verb | — |
| A84 | `useCasesConsultants.challenge.p3post` | "highlight how AI is transforming knowledge work" | ok — unrelated verb | — |
| A85 | `useCasesConsultants.exampleQuestions.q6` | "What risks does the management discussion section highlight?" | ok — unrelated | — |
| A86 | `useCasesConsultants.steps.cited.description` | "jump to the exact passage" | ok — jump | — |
| A87 | `useCasesCompliance.step3Description` | "Click any citation to jump to the exact section" | ok — jump | — |
| A88 | `useCasesRealEstate.step3Description` | "Click any citation to jump to the exact section" | ok — jump | — |
| A89 | `toolWordCounter.sampleText` | "citations tied back to the exact passage" | ok — sample text, link wording | — |
| A90 | `feedback.option.highlight_missing` | "Highlight missing" | ok — in-app, out of scope | — |
| A91 | `dashboard.workspaceNudge.body` | "tied to the exact source file" | ok — in-app, out of scope | — |
| A92 | `quoteFinder.approxHighlight` | "Highlight location is approximate" | ok — in-app, out of scope | — |
| A93 | `evidence.exact` | "Exact passage" | ok — in-app, out of scope | — |
| A94 | `evidence.hidden` | "Highlight hidden" | ok — in-app, out of scope | — |
| A95 | `evidence.hide` / `evidence.show` | "Hide highlight" / "Show highlight" | ok — in-app, out of scope (2 keys, counted as 2 hits) | — |

A50 is not a hit (it only receives the limit sentence) and A95 covers two keys, so the table lists all 95 hits
(checked by script against `en.json`).

## B. Hardcoded TSX (English pages)

| # | location | current EN | verdict | proposed EN |
|---|---|---|---|---|
| B1 | `frontend/src/app/layout.tsx:54` (root default `description`) | "Get instant answers with source citations that highlight in your document. Supports PDF, DOCX, PPTX, XLSX, and more." | overclaim — couples with formats | `Upload any document and chat with AI. Get instant answers with source citations that link back to your document. Supports PDF, DOCX, PPTX, XLSX, and more.` |
| B2 | `frontend/src/app/page.tsx:10` (`/` description) | same | overclaim — same | same as B1 |
| B3 | `frontend/src/app/page.tsx:19` | keyword `'citation highlighting'` | ok — meta keyword | — |
| B4 | `frontend/src/app/features/citations/page.tsx:9` | "Click any citation to jump to the exact source text and verify every answer" | ok — jump | — |
| B5 | `frontend/src/app/features/citations/page.tsx:12` | keyword `'citation highlighting'` | ok — meta keyword | — |
| B6 | `frontend/src/app/features/citations/page.tsx:16` (OG description) | "Click any citation to jump to the exact source text, highlighted in your document." | overclaim — any citation | `Every AI answer includes numbered citations. Click any citation to jump to the exact source text, highlighted in PDF and text files. Verify every answer.` |
| B7 | `frontend/src/app/features/page.tsx:9` | "including citation highlighting, multi-format uploads, OCR…" | ok — feature list | — |
| B8 | `frontend/src/app/features/free-demo/page.tsx:9` | "citation highlighting included from the first question" | ok — demo PDFs | — |
| B9 | `frontend/src/app/use-cases/finance/page.tsx:23` | "cited answers referencing exact source text" | ok — citation | — |
| B10 | `frontend/src/app/use-cases/finance/FinanceContent.tsx:183-187` (EN-only block) | "DocTalk keeps each answer tied to the original note, table, or paragraph through [citation highlighting]" | overclaim (borderline) — "each answer … through highlighting"; finance tables include XLSX | anchor text `citation highlighting` → `clickable citations` (link target unchanged) |
| B11 | `frontend/src/components/landing/HeroSection.tsx:273` | `tOr` fallback of A5 | ok — PDF | — |
| B12 | `frontend/src/components/landing/citationFieldContent.ts:38` | "Q4 2025 Financial Highlights" | ok — verbatim PDF text | — |
| B13 | `frontend/src/components/landing/FeatureGrid.tsx:31` | "…visual context." | ok — unrelated | — |
| B14 | `frontend/src/app/features/FeaturesHubContent.tsx:50` | `tOr` fallback of A20 | ok — unrelated | — |
| B15 | `frontend/src/app/features/layout-translation/LayoutTranslationPageContent.tsx:46` | "…visual context." | ok — unrelated | — |
| B16 | `frontend/src/app/features/layout-translation/LayoutTranslationJsonLd.tsx:28` | "…visual context." | ok — unrelated | — |
| B17 | `frontend/src/app/features/layout-translation/LayoutTranslationJsonLd.tsx:42` | "…visual context." | ok — unrelated | — |

The hardcoded `doctalk: true` cells in `CitationsContent.tsx:73-77`, `MultiFormatContent.tsx:111` and
`FreeDemoContent.tsx:55` stay true; the row labels (A34, A36, A47, A58) carry the qualifier.

## C. `frontend/public/llms.txt`

| # | line | current | verdict | proposed |
|---|---|---|---|---|
| C1 | 3 | "Upload PDF, DOCX, PPTX, XLSX, TXT, Markdown, or a URL and chat with AI that cites original text with real-time highlight navigation." | overclaim — couples with 7 formats | `> AI document chat with cited answers. Upload PDF, DOCX, PPTX, XLSX, TXT, Markdown, or a URL and chat with AI that cites original text; click a citation to jump to the source, with the passage highlighted in PDF and text files.` |
| C2 | 9 | link "Citation Highlighting" | ok — link label | — |
| C3 | 71 | link "Why Citation Highlighting Matters" | ok — post title | — |

## D. Blog posts in scope (`frontend/content/blog/`)

Overclaims, one row each. The proposed column shows the replaced sentence or cell.

| # | file:line | current EN (clause) | verdict | proposed replacement |
|---|---|---|---|---|
| D1 | `ai-document-analysis-languages.md:60` | "If you uploaded a German contract, the citations show the original German passages highlighted in the document viewer." | overclaim — contract, unconditional | `If you uploaded a German contract, the citations take you to the original German passages in the document viewer (highlighted in PDF and text files).` |
| D2 | `chat-with-excel-spreadsheet-ai.md:10` (`imageAlt` → og:image:alt) | "…with highlighted citations pointing to specific cells and rows" | overclaim — XLSX | `An Excel spreadsheet being analyzed by AI with citations pointing to specific cells and rows` |
| D3 | `chat-with-excel-spreadsheet-ai.md:94` | "The highlighted passage shows the exact rows and columns the AI used." | overclaim — XLSX | `The cited section contains the rows and columns the AI used.` |
| D4 | `chat-with-excel-spreadsheet-ai.md:172` | DocTalk cell "Click-to-highlight citations" | overclaim — XLSX | `Click-to-source citations` |
| D5 | `chat-with-powerpoint-ai.md:10` (`imageAlt`) | "…with highlighted citations from specific slides" | overclaim — PPTX | `A PowerPoint presentation being analyzed by AI with citations from specific slides` |
| D6 | `chat-with-powerpoint-ai.md:85` | "…to the corresponding slide in the document viewer, with the relevant text highlighted." | overclaim — PPTX | `Click any citation to jump to the corresponding slide in the document viewer.` |
| D7 | `chat-with-powerpoint-ai.md:130` | "The citation highlighting lets you verify the numbers directly" | overclaim — PPTX | `The citations let you verify the numbers directly, which matters when the stakes are high.` |
| D8 | `chat-with-powerpoint-ai.md:196` | "with citation-highlighted answers that let you verify every claim" | overclaim — PPTX | `…with cited answers that let you verify every claim.` |
| D9 | `chat-with-powerpoint-ai.md:200` | "You will see cited answers with highlighted source passages within seconds." | overclaim — PPTX | `You will see cited answers within seconds.` |
| D10 | `citation-highlighting-matters.md:68` | "Each numbered citation … When you click it, the document viewer scrolls to the exact page and highlights the specific passage" | overclaim — each citation | `When you click it, the document viewer scrolls to the exact page and, in PDF and text files, highlights the specific passage in the original document.` |
| D11 | `citation-highlighting-matters.md:154` | "Clicking a citation number immediately scrolls … and highlights the passage." | overclaim — unconditional | `Clicking a citation number immediately scrolls the document viewer to the relevant page and, in PDF and text files, highlights the passage.` |
| D12 | `citation-highlighting-matters.md:188` | "Upload any document to [DocTalk](/) and ask a question. … see the source passages highlighted" | overclaim — any document | `Upload a PDF to [DocTalk](/) and ask a question.` (next sentence unchanged) |
| D13 | `how-to-chat-with-docx-ai.md:10` (`imageAlt`) | "A Word document … with highlighted citations in the text" | overclaim — DOCX | `A Word document being analyzed by AI with citations in the text` |
| D14 | `how-to-chat-with-docx-ai.md:51` | "…scrolls the document viewer to the relevant section and highlights the text. The same click-to-highlight citation experience that works for PDFs works identically for Word documents." | overclaim — DOCX, false | `When the AI cites a passage from your DOCX file, clicking the citation number scrolls the document viewer to the relevant section. The passage highlight works in PDF and text files; in Word documents the passage itself is not highlighted.` |
| D15 | `how-to-chat-with-docx-ai.md:77` | "The highlighted passage shows you exactly what the AI based its answer on." | overclaim — DOCX | `The cited section shows you what the AI based its answer on.` |
| D16 | `how-to-chat-with-docx-ai.md:125` | DocTalk cell "Click a citation → passage highlighted" | overclaim — DOCX | `Click a citation → jumps to the cited section` |
| D17 | `how-to-chat-with-docx-ai.md:134` | "DocTalk's difference is how you check the answer — click a citation and the passage is highlighted in the document." | overclaim — DOCX; **decision 3** | `In DocTalk, you check an answer by clicking its citation, which jumps to the cited section of the document.` |
| D18 | `how-to-chat-with-docx-ai.md:160` | "The citation highlighting works the same way as with PDFs — click any citation to jump to the source text." | overclaim — DOCX | `Click any citation to jump to the source text.` |
| D19 | `how-to-chat-with-pdf-ai.md:149` | "All formats support the same citation highlighting and navigation features." | overclaim — all formats | `All formats support the same citation navigation; the passage highlight works in PDF and text files.` |
| D20 | `how-to-chat-with-url-webpage-ai.md:16` | "…complete with [citation highlighting](/features/citations) that points back to the source passages." | overclaim — URL | `…complete with [citations](/features/citations) that point back to the source passages.` |
| D21 | `how-to-chat-with-url-webpage-ai.md:93` | "Click any numbered citation to see the source passage highlighted in the document viewer." | overclaim — URL | `Click any numbered citation to jump to the source passage in the document viewer.` |
| D22 | `how-to-chat-with-url-webpage-ai.md:208` | "generates cited answers with highlighted source passages" | overclaim — URL | `…generates cited answers linked to their source passages, and supports follow-up questions with maintained context.` |
| D23 | `notebooklm-alternatives-2026.md:14` | "check each answer against the highlighted passage in the original file, work in Excel files" | overclaim — each answer; next to Excel | `…check each answer against the highlighted passage in the original PDF, work in Excel files…` |
| D24 | `notebooklm-alternatives-2026.md:43` | "the passage highlighted on the page of the original PDF or Word file" | overclaim — Word | `…the passage highlighted on the page of the original PDF…` |
| D25 | `notebooklm-alternatives-2026.md:51` | "DocTalk … for PDF, DOCX, PPTX, XLSX, TXT, Markdown and web URLs. Every answer carries numbered citations; click one and the document scrolls to the passage and [highlights it]" | overclaim — every answer; 7 formats | `Every answer carries numbered citations; click one and the document scrolls to the passage and, in PDF and text files, [highlights it](/features/citations).` |
| D26 | `notebooklm-alternatives-2026.md:53` | "the highlighted passage in the original file, machine-checked quotes, native Excel support" | overclaim — next to Excel | `…the highlighted passage in the original PDF, machine-checked quotes, native Excel support…` |
| D27 | `notebooklm-alternatives-2026.md:57` | "Click-to-highlight citations in the original document" | overclaim — follows the 7-format line | `Click-to-highlight citations in PDF and text files` |
| D28 | `notebooklm-alternatives-2026.md:138` | DocTalk cell "Passage highlighted in the file" (table has Word/PowerPoint/Excel rows) | overclaim — format table | `Passage highlighted (PDF, text files)` |
| D29 | `notebooklm-alternatives-2026.md:167` | "verifying answers against the highlighted passage in the original file" | overclaim — generic file | `…against the highlighted passage in the original PDF…` |
| D30 | `notebooklm-alternatives-2026.md:173` | "DocTalk: click a citation and the document scrolls to the passage and highlights it." | overclaim — unconditional | `DocTalk: click a citation and the document scrolls to the passage; in PDF and text files, it also highlights it.` |
| D31 | `rag-explained-simple.md:111` | "DocTalk highlights the exact passage in the original document viewer" | overclaim — unconditional | `In PDF and text files, DocTalk highlights the exact passage in the original document viewer, so you can read the source in full context.` |

`ok` hits in the same files (reason in brackets):

| file | ok lines |
|---|---|
| `ai-contract-review-guide.md` | 10 (image alt, no format), 24 (manual highlighting), 35 ("cite the exact passage"), 48 (feature name + "click through to see the exact source text"), 161 ("regulatory overlays") |
| `ai-document-analysis-languages.md` | 126 (feature name), 170 (works with RTL text; no format claim) |
| `ai-document-security-privacy.md` | 80 ("yellow flag") |
| `ai-due-diligence-guide.md` | 10 (image alt), 145 (feature name + click through), 152 ("Yellow flags") |
| `ai-financial-report-analysis.md` | 10 (image alt, financial-report PDFs), 14 ("visuals"), 45 (a report's "highlights") |
| `ai-research-paper-summarizer.md` | 10 (image alt, paper), 32 (paper context) |
| `chat-with-excel-spreadsheet-ai.md` | 40, 181, 193, 195 ("visual" formatting / visualization), 175 (competitor cell) |
| `chat-with-powerpoint-ai.md` | 26, 34, 36, 169, 171 ("visual" content), 106 ("Citations link to exact source") |
| `citation-highlighting-matters.md` | 2 (title), 3, 10, 11, 16, 18, 48, 50, 64, 66, 70, 74, 80, 82, 88 (concept, not a DocTalk-format claim), 94, 96, 100, 102, 106, 110, 114 (illustrative scenarios, no format), 120 (DocTalk table row, no format), 122, 124 (competitors), 130, 134, 146, 158, 166, 168, 174, 176, 178, 180 (generic / plans), 182 (false positive: "many citations") |
| `free-ai-pdf-chat-no-signup.md` | 3, 10, 30, 55, 70, 112, 117 (PDF demo context) |
| `how-to-chat-with-pdf-ai.md` | 3, 10, 50, 52, 80, 177, 193 (PDF context), 137 ("highly visual content") |
| `how-to-chat-with-url-webpage-ai.md` | 48, 115, 166, 190 ("visual" in another sense) |
| `notebooklm-alternatives-2026.md` | 153 ("against the original page"; no format) |
| `rag-explained-simple.md` | 14, 109 (generic RAG illustration, not DocTalk-specific), 40 ("visually"), 123 (ChatGPT limitation), 166 (concept) |
| `ai-hr-contract-review.md` | no hits |

## Queued for 11-07 (frozen posts — do not edit before the read)

| # | file:line | current EN (clause) | proposed replacement for 11-07 |
|---|---|---|---|
| Q1 | `best-ai-pdf-tools-2026.md:14` | "for answers you can check against the exact passage, across PDF, Word, PowerPoint and Excel, use DocTalk" | `…for answers you can check against the source, across PDF, Word, PowerPoint and Excel, use [DocTalk](/).` |
| Q2 | `best-ai-pdf-tools-2026.md:40` | "click one and the viewer scrolls to the passage and highlights it" (after the 7-format list) | `…click one and the viewer scrolls to the passage and, in PDF and text files, highlights it.` |
| Q3 | `best-ai-pdf-tools-2026.md:42` | "it combines seven formats with click-to-highlight citations" | `…it combines seven formats with clickable citations (highlighted in PDF and text files) and machine-checked quotes…` |
| Q4 | `best-ai-pdf-tools-2026.md:46` | "Click-to-highlight citations on every answer" | `Clickable citations on every answer, highlighted in PDF and text files` |
| Q5 | `best-ai-pdf-tools-2026.md:216` | "For verification against the exact passage across PDF, Word, PowerPoint and Excel, DocTalk." | `For verification against the source across PDF, Word, PowerPoint and Excel, DocTalk.` |
| Q6 | `best-ai-pdf-tools-2026.md:238` | "DocTalk combines seven formats, passage-highlighted citations" | `…combines seven formats, clickable citations (passage-highlighted in PDF and text files), machine-checked quotes…` |
| Q7 | `chatpdf-alternatives-2026.md:43` | "click one and the document scrolls to the exact passage and [highlights it]" (after the 7-format list) | `…scrolls to the exact passage and, in PDF and text files, [highlights it](/features/citations).` |
| Q8 | `chatpdf-alternatives-2026.md:45` | "citations you can click through to the highlighted passage, on seven formats" | `…citations you can click through to the source on seven formats, with the passage highlighted in PDF and text files…` |
| Q9 | `chatpdf-alternatives-2026.md:49` | "Click-to-highlight citations on every answer" | `Clickable citations on every answer, highlighted in PDF and text files` |
| Q10 | `chatpdf-alternatives-2026.md:194` | row "PDF, DOCX, PPTX, XLSX, TXT, MD, URL" + "Click citation → passage highlighted" | `Click citation → source (passage highlighted in PDF/TXT); machine-checked quotes with page` |
| Q11 | `best-ai-tools-academic-research-2026.md:45` | "…the app scrolls to the exact passage in the original paper and highlights it" (after "seven formats") | `…scrolls to the exact passage in the original paper and, in PDF and text files, highlights it.` |

`ok` hits in the frozen posts: `best-ai-pdf-tools-2026.md` 29, 96, 133, 180, 189, 199, 201, 234;
`chatpdf-alternatives-2026.md` 29, 78, 98, 117, 167, 171, 176, 205, 209, 225, 234;
`best-ai-tools-academic-research-2026.md` 10, 58, 99, 110, 168, 170, 173, 248, 254, 265, 289, 300
(PDF or paper context, competitors, or "visual" in another sense).

## Listed, not edited

- `ai-pdf-readers-page-number-citations-2026.md` (11-21 read): 14 hits (20, 38, 40, 48, 65, 77, 97, 121, 135, 138,
  149, 154, 164, 184), **0 overclaims**. The post is about PDF readers; line 48 says "for a PDF"; 149 and 184 use the
  PDF demo.
- `featuresCitations.metaTitle` "AI Answers You Can Trust: Source Citations with Real-Time Highlighting": no
  every/format claim, so not an overclaim. Not changed (metaTitle rule).
- Blog `title` "Why Citation Highlighting Matters in AI Document Analysis": not an overclaim. Not changed.
- `frontend/scripts/seo/audit_keywords.py:28` says DocTalk's citation "jumps to and highlights the exact passage".
  Internal prompt text, not user-visible. Not edited.

## Other findings, not in scope (no edit planned)

- `/features/multi-format` table (`MultiFormatContent.tsx:106`) marks ChatPDF DOCX ✗. Our own DOCX post table
  (`how-to-chat-with-docx-ai.md:126`) says ChatPDF reads DOC/DOCX. Competitor-fact conflict.
- `/features/citations` table (`CitationsContent.tsx:72-77`) marks ChatPDF ✗ for numbered citations and
  click-to-highlight, while our blog posts say ChatPDF citations jump to the source. Competitor-fact conflict.
- `featuresDemo.hero.subtitle` / `metaDescription` say the demo shows "multi-format support"; the 3 demo documents
  are all PDFs.

## Decisions needed before Phase 2

1. Accept the reconciliation above: the copy says PDF + TXT. Spin off the inert slide-view highlight and the DOCX
   page mismatch as a separate product task, or leave them?
2. "text files" is ambiguous on `/features/multi-format`, which groups "TXT / Markdown" in one card, and Markdown
   does not highlight. Keep "PDF and text files", or use "PDF and plain-text (.txt) files" everywhere?
3. D17: in the DOCX post, DocTalk's stated "difference" was the passage highlight. The honest edit drops the
   "difference" claim. Approve, or name another difference?
4. A1/A2: the landing lede and meta description change one word ("highlighted" → "cited"). OK? Bump
   `HomeJsonLd` `DATE_MODIFIED` to the ship date?
5. B10: change the finance anchor text "citation highlighting" → "clickable citations" (borderline case)?
6. The ship date for the blog `updated` field.

## Phase 2 notes

- `landing.description` feeds `HomeJsonLd` (WebSite, SoftwareApplication, HowTo). `HomeJsonLd.tsx:21` says to bump
  `DATE_MODIFIED` by hand when the product description changes materially. Proposal: bump it to the ship date.
- `featuresCitations.howStep3Title/Desc` feed the HowTo JSON-LD; `tests/marketing-jsonld.test.cjs:388-397` compares
  it with the visible steps, so parity follows automatically. `faq3Q` stays unchanged (the test pins it).
- Blog posts edited: set frontmatter `updated` to the ship date you give.
