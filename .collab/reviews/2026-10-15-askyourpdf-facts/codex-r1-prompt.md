# Codex fact-check: AskYourPDF facts site-wide (DocTalk, 2026-10-15)

Do NOT run git. Do NOT edit any file. Repo root = cwd. The diff under review (base 8ce854f9 → working tree) is pasted
at the end; the locale files are large, so for them the diff shows only `en.json` — read the other ten
`frontend/src/i18n/locales/<loc>.json` files yourself for the keys listed in §3.

## Why this changed

`.collab/reviews/2026-10-10-step5-page-citations/vendor-evidence.md` §2.6 read only AskYourPDF's `/chat-with-pdf` and
the static pricing HTML. On 10-14 AskYourPDF's other pages turned out to say more, and
`notebooklm-alternatives-2026.md` was corrected (Codex r2 SHIP, `.collab/reviews/2026-10-14-notebooklm-askyourpdf/`).
This batch carries the same facts to every other place the site describes AskYourPDF, and upgrades the PDF.ai,
Humata and Gemini Notebook cells of the notebooklm post the way the 10-14 sibling corrections did.

Evidence, read these first:
- `.collab/reviews/2026-10-14-notebooklm-askyourpdf/evidence.md` — AskYourPDF source of record (10-14).
- `.collab/reviews/2026-10-15-askyourpdf-facts/evidence.md` — the 10-15 re-read of every vendor page used here
  (nothing changed), plus PDF.ai FAQ/pricing, Humata, Gemini Notebook help and the ChatDOC guide.
- `.collab/reviews/2026-10-10-step5-page-citations/vendor-evidence.md` §2.1, §2.9–2.11 (ChatDOC, Gemini, Humata,
  PDF.ai). Its §2.6 is superseded where it differs (see its dated addendum).
- `.collab/reviews/2026-10-14-listicle-corrections/README.md` — the sibling wording for PDF.ai, Humata, Gemini.
Your sandbox may have no network; if it has, you may re-read the vendor URLs read-only.

In short: `/chat-with-pdf` lists PDF, DOCX, EPUB, TXT + a pasted URL; `/pdf-ai` and `/chat-with-documents` list PDF,
DOCX, EPUB, PPTX, RTF, TXT, CSV; no page lists XLSX/Excel. `/pdf-ai`: "Every answer includes a citation to the exact
paragraph or page in your document", a click jumps "straight to the source", "the source paragraph or page
highlighted". Prices: Premium $14.99/month billed monthly or $11.99/month billed yearly; Pro $19.99 or $14.99.

## Rules this batch follows

1. **Frozen C-9 units.** `best-ai-pdf-tools-2026.md` and `chatpdf-alternatives-2026.md` are read units for the 11-07
   C-9 read. The owner approved this third intervention on 10-15 under Fable's 10-14 Q1 rules
   (`.collab/dialogue/2026-10-14-fable-readout-rulings.md`): fact corrections only; title, frontmatter description,
   every heading, tool order, Short answer and Verdict unchanged; `updated` = ship date; no correction notice. The
   description's "Prices checked 30 September 2026" stays true: the yearly figures are unchanged, and this batch adds
   the monthly figure the 10-10 read missed; it records no price change. Flag any edit outside these limits.
   `best-ai-tools-academic-research-2026.md` and `ai-pdf-readers-page-number-citations-2026.md` must be untouched.
2. Vendor claims are written as the vendor's ("AskYourPDF says…", "vendor says…"), never as tested behaviour.
   DocTalk's own cells are product truth.
3. Differentiator sentences that rested on "AskYourPDF lacks PowerPoint" or "does not highlight" are reworded to what
   is still true (Excel/.xlsx; Quote Finder). Precedent: the 10-10 Humata batch reworded "cheaper" claims when the
   prices became equal (`.collab/reviews/2026-09-30-seo-audit/evidence/actions-log.md`, 10-10 13:36Z scope note).
4. `*.metaTitle` / `*.metaDescription` keys are not changed (frontend rule: search titles change only deliberately).

## Executor decisions for you to check

1. **Scope beyond the brief.** The brief listed the two frozen posts, 15 locale keys, `altsHumata.alt3Desc2`, and the
   notebooklm PDF.ai/Humata/Gemini cells. A grep found the same §2.6 facts in: `compareAskyourpdf.whatIsAskyourpdfDescription`,
   `altsAskyourpdf.adv6`, `altsHumata.faq4Answer`, `altsChatpdf.alt2Desc1/alt2Desc2Pre`, `altsNotebooklm.alt3Desc2/faq3Answer`,
   `altsPdfai.alt3Desc2Pre`; four TSX table cells (`comparison.linksToPage` for AskYourPDF on /features/citations,
   /compare/askyourpdf, /alternatives/askyourpdf; /features/multi-format PPTX `false` and highlight "Not verified");
   `how-to-chat-with-docx-ai.md` ("Not listed¹" for DOCX was false) and `citation-highlighting-matters.md`
   ("highlighting not stated"). Differentiators that rested on "AskYourPDF lacks PowerPoint / highlighting"
   (rule 3): `compareAskyourpdf.{whoDocTalk2, verdictParagraph2, verdictParagraph3, faq1Answer, ctaDescription}`,
   `compareHub.tagline.askyourpdf`, `altsAskyourpdf.{heroDescription, alt1Desc1, adv1, whyReason2}`. Not changed:
   `compareAskyourpdf.heroDescription`/`metaDescription` (describe DocTalk; meta key), `altsChatpdf.faq5Answer`
   (a recommendation, not a fact), `altsAskyourpdf.chooseNeed1`, `chat-with-excel-spreadsheet-ai.md:14` (Excel upload
   to AskYourPDF; no page lists .xlsx).
2. **New key `comparison.vendorSaysYes`** ("Vendor says yes") replaces "Links to the cited page" in the AskYourPDF
   highlight cells and "Not verified" in the multi-format highlight row. Not `true` (a checkmark is product truth);
   precedent `comparison.jumpsToSource` for ChatPDF. `comparison.linksToPage` is now unused but left in the files.
3. **Format lists.** Where space allows, both vendor lists are named (document pages: PDF, DOCX, EPUB, PPTX, RTF,
   TXT, CSV; chat-with-PDF page: PDF, DOCX, EPUB, TXT or a pasted URL). Short cells and some prose use the union
   "PDF, DOCX, EPUB, PPTX, RTF, TXT, CSV, URL" after "its pages list". Multi-format PPTX = `true` (a page listing
   fewer formats is not a "No"); XLSX stays `false`, TXT/MD stays "TXT".
4. **Excel = "CSV"** in the best-ai-pdf-tools table, and Limitations/Cons say "no Excel files: its pages list CSV but
   not .xlsx".
5. **Check-date sentences** keep the 10 October date for the others and add "AskYourPDF … 15 October 2026" (the 10-15
   re-read). In notebooklm: 14 October for AskYourPDF stays; PDF.ai/Humata/Gemini 15 October.
6. **Frozen posts:** the AskYourPDF section gains one sentence on formats (What it does / intro paragraph) and one
   Key-features/Pros bullet with the vendor's citation claim; the old Limitations/Cons line becomes the Excel
   limitation. Short answer, Verdict, headings, tool order, description untouched (diff shows it).
7. `citation-highlighting-matters.md:124` "Verification Effort" Low to moderate → Low (the vendor says it jumps
   to and highlights the source; ChatPDF's row with the same vendor claim is "Low"). `how-to-chat-with-docx-ai.md`
   footnote ¹ removed: no ¹ cell is left in that table.
8. **Translations** (10 locales) were made by translation agents from the English diff, reusing each locale's
   wording; the executor token-checked every number, price, format token and product name (0 issues) and read zh,
   ja, de, fr, es, pt, it, ko, ar, hi samples. pt `compareAskyourpdf.faq2Question` and `verdictParagraph3Mid` were
   half English before this batch and are now Portuguese.

## Check, adversarially

1. Every changed sentence and cell (English) against the evidence files. Flag wording stronger or weaker than the
   vendor's, any claim not in evidence, and any vendor claim stated as fact.
2. Unchanged neighbours that the change now contradicts: grep the touched pages for AskYourPDF, "PowerPoint",
   "highlight", "$11.99", "$14.99", "$19.99", "third-party", "¹".
3. Frozen-post limits (rule 1): any edit outside them?
4. Translations: for each of zh, ja, ko, es, de, fr, pt, it, ar, hi, compare the 32 keys listed in en's diff with
   `en.json`. Flag meaning drift (a hedge dropped, "says" turned into fact, a price/billing period wrong, a format
   list changed, a sentence that no longer joins the link that follows it: `*Pre`, `verdictParagraph3`).
5. Markdown tables keep their column counts; frontmatter `updated` is 2026-10-15 on the five posts.

Output numbered findings with severity (BLOCKER / SHOULD / NIT), file:line or locale:key, and a concrete fix.
End with one verdict line: SHIP, SHIP-WITH-FIXES or REWORK.

## Diff (8ce854f9 → 61b07d95; locale files: en.json and the two pt fixes only)

```diff
diff --git a/frontend/content/blog/best-ai-pdf-tools-2026.md b/frontend/content/blog/best-ai-pdf-tools-2026.md
index 34148715..59f9e805 100644
--- a/frontend/content/blog/best-ai-pdf-tools-2026.md
+++ b/frontend/content/blog/best-ai-pdf-tools-2026.md
@@ -2,7 +2,7 @@
 title: "7 Best AI PDF Tools in 2026: A Detailed Comparison"
 description: "The top AI PDF chat tools of 2026 compared on formats, citations and current pricing: DocTalk, ChatPDF, AskYourPDF, Gemini Notebook (formerly NotebookLM), Humata, PDF.ai and ChatDOC. Prices checked 30 September 2026."
 date: "2026-02-18"
-updated: "2026-10-14"
+updated: "2026-10-15"
 author: "DocTalk Team"
 category: "comparisons"
 tags: ["comparison", "ai tools", "pdf", "chatpdf", "notebooklm", "review"]
@@ -31,7 +31,7 @@ We compared each tool on five points:
 4. **Free tier and price** — what you can do for free, and what paid plans cost.
 5. **Extras** — team features, browser extensions, audio summaries and so on.
 
-Prices, limits and supported formats come from each vendor's own pricing and help pages, read on 30 September 2026; formats and citation features were checked again on 10 October 2026. Where we relied on third-party reviews instead, we say so. Plans change often, so check the vendor before you buy.
+Prices, limits and supported formats come from each vendor's own pricing and help pages, read on 30 September 2026; formats and citation features were checked again on 10 October 2026, and AskYourPDF's prices and features on 15 October 2026. Where we relied on third-party reviews instead, we say so. Plans change often, so check the vendor before you buy.
 
 ## The 7 Best AI PDF Tools
 
@@ -80,7 +80,7 @@ For a closer look, see [DocTalk vs ChatPDF](/compare/chatpdf).
 
 ### 3. [AskYourPDF](https://askyourpdf.com) — Best for Researchers
 
-**What it does:** document chat for academic workflows, with an API. It runs on the web, iOS and Android, and as a Chrome extension, a ChatGPT GPT and a Zotero plugin.
+**What it does:** document chat for academic workflows, with an API. It runs on the web, iOS and Android, and as a Chrome extension, a ChatGPT GPT and a Zotero plugin. Its own pages list different sets of formats: its PDF AI and document-chat pages list DOCX, EPUB, PPTX, RTF, TXT and CSV files, while its chat-with-PDF page lists DOCX, EPUB and TXT files or a pasted URL.
 
 **Why it stands out:** paid plans allow very long documents, and a Zotero plugin brings it to researchers who keep their papers there.
 
@@ -88,12 +88,13 @@ For a closer look, see [DocTalk vs ChatPDF](/compare/chatpdf).
 - Chrome extension and Zotero plugin
 - API for developers
 - Up to 2,500 pages per document on Premium and 6,000 on Pro
+- AskYourPDF says each answer cites "the exact paragraph or page", that clicking the citation jumps to the source, and that the source is highlighted
 
-**Pricing:** Free: 1 document a day (100 pages, 15 MB), 50 questions a day. Premium: $11.99/month. Pro: $14.99/month. Enterprise: custom.
+**Pricing:** Free: 1 document a day (100 pages, 15 MB), 50 questions a day. Premium: $14.99/month, or $11.99/month billed yearly. Pro: $19.99/month, or $14.99/month billed yearly. Enterprise: custom.
 
 **Best for:** PhD students and researchers with large paper collections.
 
-**Limitations:** tight free plan; each answer cites the page it came from and you click the citation to check it, but AskYourPDF does not say it highlights the passage.
+**Limitations:** tight free plan, and no Excel files: its pages list CSV but not .xlsx.
 
 ### 4. [Gemini Notebook](https://notebook.google) (formerly NotebookLM) — Best Free Option
 
@@ -168,18 +169,18 @@ See our [DocTalk vs NotebookLM](/compare/notebooklm) comparison.
 
 ## Master Comparison Table
 
-Checked 30 September 2026 on each vendor's own site unless noted; formats and citation features checked again 10 October 2026.
+Checked 30 September 2026 on each vendor's own site unless noted; formats and citation features checked again 10 October 2026, and AskYourPDF 15 October 2026.
 
 | Feature | DocTalk | ChatPDF | AskYourPDF | Gemini Notebook | Humata | PDF.ai | ChatDOC |
 |---|---|---|---|---|---|---|---|
 | **PDF** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
 | **Word** | Yes | Yes | Yes | Yes | —¹ | No | Pro |
-| **PowerPoint** | Yes | Yes | — | Yes | —¹ | No | — |
-| **Excel** | Yes | No | No | Sheets/CSV | —¹ | No | — |
+| **PowerPoint** | Yes | Yes | Yes | Yes | —¹ | No | — |
+| **Excel** | Yes | No | CSV | Sheets/CSV | —¹ | No | — |
 | **Web URL** | Yes | Yes | Yes | Yes | — | No | Pro |
-| **How you check** | Passage highlighted | Scrolls to source | Page citation, click to check | Inline citation, jumps to the quote | Cited links to files; "Highlights citations" (unspecified) | Cited sources | Page number, click to jump |
+| **How you check** | Passage highlighted | Scrolls to source | Paragraph or page cited; vendor says a click jumps there and highlights it | Inline citation, jumps to the quote | Cited links to files; "Highlights citations" (unspecified) | Cited sources | Page number, click to jump |
 | **Free tier** | 500 starter, then 300/mo | 2 docs/day | 1 doc/day | 100 notebooks | 60 pages/mo | 1 upload/mo | 5 files/day (homepage; guide/FAQ say 2/day) |
-| **Paid from** | $9.99/mo | Not published | $11.99/mo | Google AI plans | $9.99/mo | $10/mo (yearly) | $8.99/30 days |
+| **Paid from** | $9.99/mo | Not published | $11.99/mo (yearly) | Google AI plans | $9.99/mo | $10/mo (yearly) | $8.99/30 days |
 | **No-signup demo** | Yes | — | — | — | — | — | — |
 
 ¹ From third-party reviews, not the vendor's own page. "—" means we could not confirm it either way.
diff --git a/frontend/content/blog/chatpdf-alternatives-2026.md b/frontend/content/blog/chatpdf-alternatives-2026.md
index fc8217d7..f241c8ea 100644
--- a/frontend/content/blog/chatpdf-alternatives-2026.md
+++ b/frontend/content/blog/chatpdf-alternatives-2026.md
@@ -2,7 +2,7 @@
 title: "7 Best ChatPDF Alternatives in 2026 (Free and Paid)"
 description: "ChatPDF alternatives compared on formats, citations and current pricing: DocTalk, AskYourPDF, PDF.ai, Humata, Gemini Notebook (formerly NotebookLM), Consensus and Claude. Prices checked 30 September 2026."
 date: "2026-03-18"
-updated: "2026-10-14"
+updated: "2026-10-15"
 author: "DocTalk Team"
 category: "comparisons"
 tags: ["chatpdf", "comparison", "alternatives", "ai tools", "pdf", "document chat"]
@@ -22,7 +22,7 @@ keywords: ["chatpdf alternative", "chatpdf alternatives 2026", "best chatpdf alt
 
 ChatPDF introduced millions of people to a simple idea in 2023: upload a PDF, ask questions, get answers. It is still a good tool for that. This guide compares seven alternatives on the things that decide daily use — which files they read, how you check an answer, the free tier, and what you pay.
 
-**How we compiled this:** every price and limit below comes from the vendor's own pricing or help page, read on 30 September 2026, unless we say otherwise; formats and citation features were checked again on 10 October 2026. Plans change often, so check the vendor's page before you buy.
+**How we compiled this:** every price and limit below comes from the vendor's own pricing or help page, read on 30 September 2026, unless we say otherwise; formats and citation features were checked again on 10 October 2026, and AskYourPDF's prices and features on 15 October 2026. Plans change often, so check the vendor's page before you buy.
 
 ## Why People Look for ChatPDF Alternatives
 
@@ -64,7 +64,7 @@ If you only need quick answers from a few files a day, ChatPDF may still be the
 
 ### 2. AskYourPDF — Best for Research Integration
 
-[AskYourPDF](https://askyourpdf.com) began as a ChatGPT plugin and is now a standalone app and API. It runs on the web, iOS and Android, and as a Chrome extension, a ChatGPT GPT and a Zotero plugin.
+[AskYourPDF](https://askyourpdf.com) is a standalone app with a developer API. It runs on the web, iOS and Android, and as a Chrome extension, a ChatGPT GPT and a Zotero plugin. Its own pages list different sets of formats: its PDF AI and document-chat pages list DOCX, EPUB, PPTX, RTF, TXT and CSV files, while its chat-with-PDF page lists DOCX, EPUB and TXT files or a pasted URL.
 
 **What sets it apart:** very large page allowances on paid plans and a Zotero plugin for researchers.
 
@@ -72,12 +72,13 @@ If you only need quick answers from a few files a day, ChatPDF may still be the
 - Zotero plugin and Chrome extension
 - Developer API
 - Very large page allowances on paid plans (2,500 pages per document on Premium, 6,000 on Pro)
+- AskYourPDF says each answer cites "the exact paragraph or page", that clicking the citation jumps to the source, and that the source is highlighted
 
 **Cons:**
 - Tight free plan: 1 document a day, up to 100 pages and 15 MB, 50 questions a day
-- Each answer cites the page it came from and you click the citation to check it; AskYourPDF does not say it highlights the passage
+- No Excel files: its pages list CSV but not .xlsx
 
-**Pricing:** Free (limits above). Premium: $11.99/month. Pro: $14.99/month. Enterprise: custom.
+**Pricing:** Free (limits above). Premium: $14.99/month, or $11.99/month billed yearly. Pro: $19.99/month, or $14.99/month billed yearly. Enterprise: custom.
 
 **Best for:** Zotero users and heavy PDF readers. See our [DocTalk vs AskYourPDF comparison](/compare/askyourpdf).
 
@@ -187,13 +188,13 @@ People searching for "Chatty PDF" are often looking for ChatPDF, but [ChattyPDF]
 
 ## Comparison Table
 
-Prices and limits as published by each vendor, checked 30 September 2026; formats and citation features checked again 10 October 2026.
+Prices and limits as published by each vendor, checked 30 September 2026; formats and citation features checked again 10 October 2026, and AskYourPDF 15 October 2026.
 
 | Tool | Reads | How you check an answer | Free tier | Paid from |
 |---|---|---|---|---|
 | **DocTalk** | PDF, DOCX, PPTX, XLSX, TXT, MD, URL | Click citation → passage highlighted; machine-checked quotes with page | 500 starter credits, then 300/mo | $9.99/mo |
 | **ChatPDF** | PDF, DOC/DOCX, PPT/PPTX, MD, TXT | Clickable citations that scroll to the source | 2 documents/day | Not published |
-| **AskYourPDF** | PDF, DOCX, EPUB, TXT, URL | Page citation, click to check | 1 doc/day, 50 questions | $11.99/mo |
+| **AskYourPDF** | PDF, DOCX, EPUB, PPTX, RTF, TXT, CSV, URL | Paragraph or page cited; vendor says a click jumps there and highlights it | 1 doc/day, 50 questions | $11.99/mo (yearly) |
 | **PDF.ai** | PDF | Cited sources | 1 upload/mo, 100 questions | $10/mo (yearly) |
 | **Humata** | Uploaded files | Links to cited source files | 60 pages/mo | $9.99/mo |
 | **Gemini Notebook** | Docs, PDF, PPTX, Sheets/CSV, web, YouTube, audio… | Inline citations; select one to jump to the quote | 100 notebooks, 50 sources each | Google AI plans |
diff --git a/frontend/content/blog/citation-highlighting-matters.md b/frontend/content/blog/citation-highlighting-matters.md
index e93ac7fc..dfd8823c 100644
--- a/frontend/content/blog/citation-highlighting-matters.md
+++ b/frontend/content/blog/citation-highlighting-matters.md
@@ -2,7 +2,7 @@
 title: "Why Citation Highlighting Matters in AI Document Analysis"
 description: "AI tools that generate answers without source citations are a liability. Learn why citation highlighting is essential for trust, accuracy, and professional use of AI document analysis."
 date: "2026-03-18"
-updated: "2026-10-12"
+updated: "2026-10-15"
 author: "DocTalk Team"
 category: "ai-insights"
 tags: ["citations", "hallucination", "trust", "rag", "verification", "ai insights"]
@@ -121,11 +121,11 @@ A compliance officer asks about a policy document: "What are the reporting deadl
 | ChatDOC | Page number on each answer; click it to jump | Low | Yes — jumps to the section |
 | Adobe Acrobat AI Assistant | Highlights where it found the answer; page number in PDF Spaces | Low | Yes — highlighted in the document |
 | ChatPDF | Clickable citations that scroll to the source | Low | Yes — jumps to the source passage |
-| AskYourPDF | Citation back to the exact page; click to verify | Low to moderate | The page; highlighting not stated |
+| AskYourPDF | Citation to "the exact paragraph or page"; click to jump to the source | Low | Vendor says the source is highlighted |
 | Gemini Notebook (formerly NotebookLM) | Direct quotes; select one to jump to it | Low | Yes — the quote in context, no page number |
 | PDF.ai | Sources listed with each answer | Moderate | Not documented |
 
-Rows other than DocTalk describe what each vendor documents on its own pages, checked on 10 October 2026. For the quotes and links, see [which AI PDF readers cite the page number for every answer](/blog/ai-pdf-readers-page-number-citations-2026).
+Rows other than DocTalk describe what each vendor documents on its own pages, checked on 10 October 2026 (AskYourPDF on 15 October 2026). For the quotes and links, see [which AI PDF readers cite the page number for every answer](/blog/ai-pdf-readers-page-number-citations-2026).
 
 Click-to-navigate citations are now common. The differences that remain are whether the exact passage is highlighted, and whether the citation shows a page number you can put in a reference. A jump without a highlight still leaves you scanning; a quote without a page number still leaves you searching the PDF before you can cite it. See our [ChatPDF comparison](/compare/chatpdf) for a more detailed analysis.
 
diff --git a/frontend/content/blog/how-to-chat-with-docx-ai.md b/frontend/content/blog/how-to-chat-with-docx-ai.md
index a9c8d384..63d01cf4 100644
--- a/frontend/content/blog/how-to-chat-with-docx-ai.md
+++ b/frontend/content/blog/how-to-chat-with-docx-ai.md
@@ -2,7 +2,7 @@
 title: "How to Chat with Word Documents (DOCX) Using AI"
 description: "Many AI PDF tools still expect a PDF. Learn how DocTalk lets you chat with Word (DOCX) files, with paragraph and table extraction and cited answers you can click through to the passage."
 date: "2026-02-18"
-updated: "2026-10-12"
+updated: "2026-10-15"
 author: "DocTalk Team"
 category: "guides"
 tags: ["docx", "word", "ai chat", "tutorial", "multi-format"]
@@ -19,7 +19,7 @@ If you have been converting your DOCX files to PDF just to use an AI chat tool,
 
 Microsoft Word is the default document format for most businesses, law firms, government agencies, and academic institutions. The format is based on [Microsoft's OOXML specification](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-docx/). According to Microsoft, there are over 1 billion Office users worldwide, and Word remains the most-used application in the suite.
 
-Yet several AI PDF tools still expect a PDF — PDF.ai, for example, is PDF-focused according to third-party reviews — so Word files have to be converted before upload. That conversion step introduces several problems:
+Yet several AI PDF tools still expect a PDF — PDF.ai, for example, says in its FAQ that you can only upload PDF files — so Word files have to be converted before upload. That conversion step introduces several problems:
 
 - **Lost formatting**: Headers, footers, and complex layouts can shift during PDF conversion
 - **Table corruption**: Multi-column tables sometimes merge cells or lose alignment
@@ -118,20 +118,20 @@ DocTalk supports multiple chat sessions per document. If you are analyzing a 100
 
 ## Comparing DOCX Support Across AI Tools
 
-Checked 30 September 2026 on each vendor's own site unless marked.
+Checked 30 September 2026 on each vendor's own site; AskYourPDF, Gemini Notebook, ChatDOC and PDF.ai checked again 15 October 2026.
 
 | Tool | Native DOCX | Table Support | How you check an answer |
 |---|---|---|---|
 | **DocTalk** | Yes | Full table extraction | Click a citation → passage highlighted |
 | ChatPDF | Yes (DOC/DOCX) | — | Clickable citations that scroll to the source |
-| AskYourPDF | Not listed¹ | — | Page-level text references¹ |
-| Gemini Notebook (formerly NotebookLM) | Yes (Word) | — | Inline source citations |
-| ChatDOC | Yes (Pro plan) | — | TapSource citations |
-| PDF.ai | No¹ (PDF-focused) | N/A | Text references¹ |
+| AskYourPDF | Yes (DOCX) | — | Paragraph or page cited; vendor says a click jumps there and highlights it |
+| Gemini Notebook (formerly NotebookLM) | Yes (Word) | — | Inline citations; select one to jump to the quote |
+| ChatDOC | Yes (Pro plan) | — | Page number, click to jump |
+| PDF.ai | No (PDF only) | N/A | Cited sources |
 
-¹ From third-party reviews. "—" means we could not confirm it.
+"—" means we could not confirm it.
 
-Word support is no longer rare: DocTalk, ChatPDF, Gemini Notebook and ChatDOC (on Pro) all read DOCX natively. In DocTalk, clicking a citation highlights the cited passage in the document. When DocTalk cannot pinpoint the passage, it shows the cited page instead.
+Word support is no longer rare: DocTalk, ChatPDF, AskYourPDF, Gemini Notebook and ChatDOC (on Pro) all read DOCX natively. In DocTalk, clicking a citation highlights the cited passage in the document. When DocTalk cannot pinpoint the passage, it shows the cited page instead.
 
 ## Frequently Asked Questions
 
diff --git a/frontend/content/blog/notebooklm-alternatives-2026.md b/frontend/content/blog/notebooklm-alternatives-2026.md
index c0582e93..bbe4f998 100644
--- a/frontend/content/blog/notebooklm-alternatives-2026.md
+++ b/frontend/content/blog/notebooklm-alternatives-2026.md
@@ -2,7 +2,7 @@
 title: "5 Best NotebookLM Alternatives in 2026"
 description: "NotebookLM is now Gemini Notebook. Five alternatives compared on formats, how you check an answer, and current pricing: DocTalk, ChatPDF, AskYourPDF, Humata and PDF.ai. Prices checked 30 September 2026."
 date: "2026-03-18"
-updated: "2026-10-14"
+updated: "2026-10-15"
 author: "DocTalk Team"
 category: "comparisons"
 tags: ["notebooklm", "gemini notebook", "alternatives", "comparison", "ai tools", "google", "document chat"]
@@ -18,7 +18,7 @@ keywords: ["notebooklm alternative", "notebooklm alternatives 2026", "google not
 > - **ChatPDF** reads Word, PowerPoint, Markdown and text files as well as PDFs, and its citations scroll to the source.
 > - **AskYourPDF**, **Humata** and **PDF.ai** changed their plans; the prices below are current.
 
-**How we compiled this:** prices, limits and supported formats come from each vendor's own pricing and help pages, read on 30 September 2026; AskYourPDF's prices and features were checked again on 14 October 2026. Where we relied on third-party reviews, we say so. Plans change often, so check before you buy.
+**How we compiled this:** prices, limits and supported formats come from each vendor's own pricing and help pages, read on 30 September 2026; AskYourPDF's prices and features were checked again on 14 October 2026, and the formats and citation features of PDF.ai, Humata and Gemini Notebook on 15 October 2026. Where we relied on third-party reviews, we say so. Plans change often, so check before you buy.
 
 ## What Gemini Notebook (NotebookLM) Does Well
 
@@ -40,7 +40,7 @@ Any replacement should match these strengths, or have a good reason not to:
 
 **Excel files.** There is no native .xlsx upload; you work through Google Sheets or CSV instead.
 
-**Checking an answer in the original layout.** Gemini Notebook cites the source text inline. If you need to see the passage highlighted on the page of the original PDF — for tables, figures, legal clauses or a thesis quote — a document-first tool fits better.
+**Checking an answer in the original layout.** Gemini Notebook cites the source text inline, and selecting a citation takes you to the quote in context. If you need to see the passage highlighted on the page of the original PDF — for tables, figures, legal clauses or a thesis quote — a document-first tool fits better.
 
 **Quotes you can reuse with a page number.** For academic or legal writing you may want quotes checked against the source and tied to the page they come from.
 
@@ -104,7 +104,7 @@ Any replacement should match these strengths, or have a good reason not to:
 
 **Key differences:**
 - Team plan with permissions and OCR
-- Answers link to the cited files
+- Answers link to the cited files; Humata says it "highlights citations" but does not say what is highlighted or where
 - Free plan: 60 pages a month
 
 **Pricing:** Free: 60 pages/month. Expert: $9.99/month (3 users, 500 pages/month). Team: $49 per user per month (5,000 pages/month). Enterprise: custom.
@@ -119,7 +119,7 @@ Any replacement should match these strengths, or have a good reason not to:
 
 **Key differences:**
 - Simple split-screen viewer and chat
-- PDF-focused (third-party reviews report no native Word or PowerPoint chat)
+- PDF only: "You can only upload PDF (.pdf) files at the moment" (PDF.ai FAQ)
 - Free plan: 1 upload and 100 questions a month
 
 **Pricing:** Hobby: free. Pro: $17/month, or $10/month billed yearly. Ultimate: $27/month, or $20/month yearly. Enterprise: $37 per user per month, or $30 yearly.
@@ -128,15 +128,15 @@ Any replacement should match these strengths, or have a good reason not to:
 
 ## Comparison Table
 
-Checked 30 September 2026 on each vendor's own site unless marked; AskYourPDF's prices and features checked again 14 October 2026.
+Checked 30 September 2026 on each vendor's own site unless marked; AskYourPDF's prices and features checked again 14 October 2026; PDF.ai's, Humata's and Gemini Notebook's formats and citation features 15 October 2026.
 
 | Feature | Gemini Notebook | DocTalk | ChatPDF | AskYourPDF | Humata | PDF.ai |
 |---|---|---|---|---|---|---|
 | **Free tier** | 100 notebooks, 50 sources each | 500 starter, then 300 credits/mo | 2 docs/day | 1 doc/day | 60 pages/mo | 1 upload/mo |
 | **Paid from** | Google AI plans | $9.99/mo | Not published | $11.99/mo (yearly) | $9.99/mo | $10/mo (yearly) |
-| **Word / PowerPoint** | Yes / Yes | Yes / Yes | Yes / Yes | Yes / Yes | —¹ | No¹ |
+| **Word / PowerPoint** | Yes / Yes | Yes / Yes | Yes / Yes | Yes / Yes | —¹ | No / No |
 | **Excel** | Sheets or CSV | Native .xlsx | No | CSV | —¹ | No |
-| **How you check an answer** | Inline citation | Passage highlighted in the file | Scrolls to source | Paragraph or page cited; vendor says a click jumps there and highlights it | Link to file | Text reference¹ |
+| **How you check an answer** | Inline citation, jumps to the quote | Passage highlighted in the file | Scrolls to source | Paragraph or page cited; vendor says a click jumps there and highlights it | Cited links to files; "Highlights citations" (unspecified) | Cited sources |
 | **Audio overviews** | Yes | No | No | Separate extension (PodcastAnywhere) | No | No |
 | **Google account needed** | Yes | No | No | No | No | No |
 
@@ -171,7 +171,7 @@ If you need free and many sources, Gemini Notebook itself is hard to beat. For v
 Yes. Gemini Notebook (formerly NotebookLM) accepts Word and PowerPoint files, but not native .xlsx — use Google Sheets or CSV for spreadsheets.
 
 ### Which NotebookLM alternative shows the source passage in the original document?
-DocTalk: click a citation and the document scrolls to the passage and highlights it. When DocTalk cannot pinpoint the passage, it shows the cited page instead. ChatPDF's citations also scroll to the source in a side-by-side view.
+DocTalk: click a citation and the document scrolls to the passage and highlights it. When DocTalk cannot pinpoint the passage, it shows the cited page instead. ChatPDF's citations also scroll to the source in a side-by-side view, and AskYourPDF says a click on a citation jumps to the source and highlights it.
 
 ## Final Thoughts
 
diff --git a/frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx b/frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx
index dc24357a..b4d1f898 100644
--- a/frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx
+++ b/frontend/src/app/alternatives/askyourpdf/AskyourpdfAltsContent.tsx
@@ -23,7 +23,7 @@ export default async function AskyourpdfAltsContent({ locale }: { locale: string
 
   const quickCompare = [
     { name: t('altsAskyourpdf.tableFileFormats'), doctalk: t('altsAskyourpdf.table7Formats'), competitor: t('altsAskyourpdf.tablePdfOnly') },
-    { name: t('altsAskyourpdf.tableCitationHighlighting'), doctalk: true, competitor: t('comparison.linksToPage') },
+    { name: t('altsAskyourpdf.tableCitationHighlighting'), doctalk: true, competitor: t('comparison.vendorSaysYes') },
     { name: t('altsAskyourpdf.tableLanguages'), doctalk: '11', competitor: t('comparison.notVerified') },
     { name: t('altsAskyourpdf.tableFreeTier'), doctalk: t('altsAskyourpdf.tableFreeTierDoctalk'), competitor: t('altsAskyourpdf.tableFreeTierCompetitor') },
     { name: t('altsAskyourpdf.tableStartingPrice'), doctalk: '$9.99/mo', competitor: t('altsAskyourpdf.tableStartingPriceCompetitor') },
diff --git a/frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx b/frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx
index c2dc3f77..7b576616 100644
--- a/frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx
+++ b/frontend/src/app/compare/askyourpdf/AskyourpdfContent.tsx
@@ -21,7 +21,7 @@ export default async function AskyourpdfContent({ locale }: { locale: string })
 
   const features = [
     { name: t('compareAskyourpdf.featureSupportedFormats'), doctalk: t('compareAskyourpdf.featureSupportedFormatsDocTalk'), competitor: t('compareAskyourpdf.featureSupportedFormatsCompetitor') },
-    { name: t('compareAskyourpdf.featureCitationHighlighting'), doctalk: true, competitor: t('comparison.linksToPage') },
+    { name: t('compareAskyourpdf.featureCitationHighlighting'), doctalk: true, competitor: t('comparison.vendorSaysYes') },
     { name: t('compareAskyourpdf.featureChromeExtension'), doctalk: false, competitor: true },
     { name: t('compareAskyourpdf.featureZoteroPlugin'), doctalk: false, competitor: true },
     { name: t('compareAskyourpdf.featureApiAccess'), doctalk: false, competitor: true },
diff --git a/frontend/src/app/features/citations/CitationsContent.tsx b/frontend/src/app/features/citations/CitationsContent.tsx
index fdc64300..e21d07a4 100644
--- a/frontend/src/app/features/citations/CitationsContent.tsx
+++ b/frontend/src/app/features/citations/CitationsContent.tsx
@@ -71,12 +71,14 @@ export default async function CitationsContent({ locale }: { locale: string }) {
   // Competitor cells follow each vendor's own pages (checked 2026-10); a
   // feature the vendor does not document is "Not verified", never "No".
   // Humata click-to-highlight is 'partial': its homepage lists "Highlights
-  // citations" but does not say what is highlighted or where.
+  // citations" but does not say what is highlighted or where. AskYourPDF's
+  // /pdf-ai page says a click jumps to the source and highlights it: a vendor
+  // claim, shown as such (.collab/reviews/2026-10-14-notebooklm-askyourpdf/evidence.md).
   // Source: .collab/reviews/2026-10-10-step5-page-citations/vendor-evidence.md.
   const notVerified = t('comparison.notVerified');
   const comparisonRows = [
     { feature: t('featuresCitations.compNumberedCitations'), doctalk: true, chatpdf: notVerified, askyourpdf: notVerified, humata: notVerified },
-    { feature: t('featuresCitations.compClickHighlight'), doctalk: true, chatpdf: t('comparison.jumpsToSource'), askyourpdf: t('comparison.linksToPage'), humata: 'partial' as const },
+    { feature: t('featuresCitations.compClickHighlight'), doctalk: true, chatpdf: t('comparison.jumpsToSource'), askyourpdf: t('comparison.vendorSaysYes'), humata: 'partial' as const },
     { feature: t('featuresCitations.compPageAttribution'), doctalk: true, chatpdf: true, askyourpdf: true, humata: 'partial' as const },
     { feature: t('featuresCitations.compBboxHighlight'), doctalk: true, chatpdf: notVerified, askyourpdf: notVerified, humata: notVerified },
     { feature: t('featuresCitations.compTextSnippet'), doctalk: true, chatpdf: notVerified, askyourpdf: notVerified, humata: notVerified },
diff --git a/frontend/src/app/features/multi-format/MultiFormatContent.tsx b/frontend/src/app/features/multi-format/MultiFormatContent.tsx
index e05aaeb6..5809eb3c 100644
--- a/frontend/src/app/features/multi-format/MultiFormatContent.tsx
+++ b/frontend/src/app/features/multi-format/MultiFormatContent.tsx
@@ -106,15 +106,19 @@ export default async function MultiFormatContent({ locale }: { locale: string })
   // format list omits the format; anything else is "Not verified".
   // Sources: .collab/reviews/2026-10-10-step5-page-citations/vendor-evidence.md,
   // .collab/reviews/2026-10-01-listicle-refresh/competitor-facts-2026-09-30.md.
+  // AskYourPDF (re-read 2026-10-15, .collab/reviews/2026-10-14-notebooklm-askyourpdf/evidence.md):
+  // its /pdf-ai and /chat-with-documents pages list PPTX (its /chat-with-pdf page
+  // does not), no page lists .xlsx, and /pdf-ai says the cited source is
+  // highlighted, which the table shows as a vendor claim, not as a checkmark.
   const notVerified = t('comparison.notVerified');
   const comparisonRows = [
     { format: t('featuresMultiFormat.compPdf'), doctalk: true, chatpdf: true, askyourpdf: true, notebooklm: true },
     { format: t('featuresMultiFormat.compDocx'), doctalk: true, chatpdf: true, askyourpdf: true, notebooklm: true },
-    { format: t('featuresMultiFormat.compPptx'), doctalk: true, chatpdf: true, askyourpdf: false, notebooklm: true },
+    { format: t('featuresMultiFormat.compPptx'), doctalk: true, chatpdf: true, askyourpdf: true, notebooklm: true },
     { format: t('featuresMultiFormat.compXlsx'), doctalk: true, chatpdf: false, askyourpdf: false, notebooklm: false },
     { format: t('featuresMultiFormat.compTxtMd'), doctalk: true, chatpdf: true, askyourpdf: 'TXT', notebooklm: true },
     { format: t('featuresMultiFormat.compUrl'), doctalk: true, chatpdf: true, askyourpdf: true, notebooklm: true },
-    { format: t('featuresMultiFormat.compCitationHighlight'), doctalk: true, chatpdf: notVerified, askyourpdf: notVerified, notebooklm: notVerified },
+    { format: t('featuresMultiFormat.compCitationHighlight'), doctalk: true, chatpdf: notVerified, askyourpdf: t('comparison.vendorSaysYes'), notebooklm: notVerified },
   ];
 
   const faqItems = [
diff --git a/frontend/src/i18n/locales/en.json b/frontend/src/i18n/locales/en.json
index f21d44cb..2a94ff4e 100644
--- a/frontend/src/i18n/locales/en.json
+++ b/frontend/src/i18n/locales/en.json
@@ -693,6 +693,7 @@
   "comparison.jumpsToSource": "Jumps to source",
   "comparison.linksToPage": "Links to the cited page",
   "comparison.sourcesListed": "Sources listed",
+  "comparison.vendorSaysYes": "Vendor says yes",
   "doc.invalidPdfUrl": "Invalid PDF URL",
   "doc.resizePanels": "Resize panels",
   "billing.perMonth": "/mo",
@@ -1410,7 +1411,7 @@
   "compareHub.metaDescription": "Honest, feature-by-feature comparisons between DocTalk and other popular AI document tools. See how each tool handles format support, citations, pricing, and more.",
   "compareHub.vsLabel": "DocTalk vs {name}",
   "compareHub.tagline.chatpdf": "Excel support and highlighted citations vs no-account chat with PDF, Word and PowerPoint.",
-  "compareHub.tagline.askyourpdf": "Highlighted citations in one web app vs an ecosystem of extensions and integrations.",
+  "compareHub.tagline.askyourpdf": "One web app that also reads Excel vs an ecosystem of extensions and integrations.",
   "compareHub.tagline.notebooklm": "Single-document focus with highlighted citations vs Google's multi-source notebooks.",
   "compareHub.tagline.humata": "Per-question credits and 11 languages vs page-based team plans.",
   "compareHub.tagline.pdfai": "7 document formats and highlighted PDF citations vs PDF-only chat.",
@@ -1673,8 +1674,8 @@
   "altsChatpdf.adv5": "No-signup instant demo",
   "altsChatpdf.adv6": "Published prices: Plus $9.99/month, Pro $19.99/month",
   "altsChatpdf.alt2Title": "AskYourPDF — Best for Researchers",
-  "altsChatpdf.alt2Desc1": "AskYourPDF stands out with its research-oriented ecosystem: a Chrome extension, a Zotero plugin, iOS and Android apps, a ChatGPT GPT and an API for developers. Its chat reader accepts PDF, DOCX, EPUB and TXT files or a pasted URL.",
-  "altsChatpdf.alt2Desc2Pre": "Each answer cites the exact page in the original PDF, and you can click the citation to verify it. The free plan allows 1 document and 50 questions a day. Premium costs $11.99 per month, billed yearly. For researchers embedded in the Zotero ecosystem, AskYourPDF is hard to beat. See our",
+  "altsChatpdf.alt2Desc1": "AskYourPDF stands out with its research-oriented ecosystem: a Chrome extension, a Zotero plugin, iOS and Android apps, a ChatGPT GPT and an API for developers. Its pages list PDF, DOCX, EPUB, PPTX, RTF, TXT and CSV files and pasted URLs.",
+  "altsChatpdf.alt2Desc2Pre": "AskYourPDF says each answer cites the exact paragraph or page, and that clicking the citation jumps to the source and highlights it. The free plan allows 1 document and 50 questions a day. Premium costs $14.99 per month, or $11.99 per month billed yearly. For researchers embedded in the Zotero ecosystem, AskYourPDF is hard to beat. See our",
   "altsChatpdf.alt2CompareLink": "AskYourPDF comparison",
   "altsChatpdf.alt2BestFor": "Academic researchers, Zotero users, developers needing API access",
   "altsChatpdf.alt3Title": "Humata — Best for Teams",
@@ -1754,7 +1755,7 @@
   "altsNotebooklm.alt2BestFor": "Users who want the simplest PDF Q&A tool",
   "altsNotebooklm.alt3Title": "AskYourPDF — Best for Researchers",
   "altsNotebooklm.alt3Desc1": "AskYourPDF is the best NotebookLM alternative for academic researchers who need integration with their existing research tools. The Zotero plugin connects it to your reference library, the Chrome extension works in your browser, and an API is available for programmatic access.",
-  "altsNotebooklm.alt3Desc2": "Where Gemini Notebook's notebooks encourage exploratory cross-document research, AskYourPDF targets structured academic workflows. Each answer cites the exact page, and you can click to verify it. Premium costs $11.99 per month, billed yearly.",
+  "altsNotebooklm.alt3Desc2": "Where Gemini Notebook's notebooks encourage exploratory cross-document research, AskYourPDF targets structured academic workflows. It says each answer cites the exact paragraph or page, and that clicking the citation jumps to the source and highlights it. Premium costs $14.99 per month, or $11.99 per month billed yearly.",
   "altsNotebooklm.alt3BestFor": "Academic researchers, Zotero users, developers",
   "altsNotebooklm.alt4Title": "Humata — Best for Teams",
   "altsNotebooklm.alt4Desc1": "Humata is built around team plans. Its Team plan covers up to 10 users with 5,000 pages a month and department and folder permissions, and its Expert plan covers up to 3 users. Its homepage lists 'Highlights citations' as a feature.",
@@ -1782,7 +1783,7 @@
   "altsNotebooklm.faq2Question": "Is there a free NotebookLM alternative?",
   "altsNotebooklm.faq2Answer": "Yes. DocTalk offers a free demo with no signup required and a free tier with 300 credits per month. ChatPDF's free plan covers 2 documents a day, and Elicit's free plan includes unlimited search and chat with papers. Gemini Notebook itself is free with usage limits, not unlimited.",
   "altsNotebooklm.faq3Question": "Which NotebookLM alternative has the best citations?",
-  "altsNotebooklm.faq3Answer": "When you click a citation, DocTalk scrolls to the cited passage in your original document and highlights it. Among the alternatives here, AskYourPDF cites the exact page and Elicit uses sentence-level citations. Gemini Notebook itself opens the quoted passage in context but does not document page numbers.",
+  "altsNotebooklm.faq3Answer": "When you click a citation, DocTalk scrolls to the cited passage in your original document and highlights it. Among the alternatives here, AskYourPDF says it cites the exact paragraph or page and highlights the source, and Elicit uses sentence-level citations. Gemini Notebook itself opens the quoted passage in context but does not document page numbers.",
   "altsNotebooklm.faq4Question": "Can any alternative create audio podcasts like NotebookLM?",
   "altsNotebooklm.faq4Answer": "Gemini Notebook (formerly NotebookLM) lists Audio Overviews among its features. DocTalk does not create audio, and we did not check the other alternatives on this page for audio features. If audio summaries matter to your workflow, start with Gemini Notebook.",
   "altsNotebooklm.faq5Question": "Which alternative is best for scientific papers?",
@@ -1822,7 +1823,7 @@
   "altsHumata.alt2BestFor": "Users who want a simple document chat tool with no account needed",
   "altsHumata.alt3Title": "AskYourPDF — Best for Integrations",
   "altsHumata.alt3Desc1": "AskYourPDF offers a wide integration ecosystem: a Chrome extension, a Zotero plugin, iOS and Android apps, a ChatGPT GPT and a developer API. For power users who need document analysis as part of a larger toolchain, that flexibility is the main draw.",
-  "altsHumata.alt3Desc2": "Its chat reader accepts PDF, DOCX, EPUB and TXT files or a pasted URL, and each answer cites the exact page, which you can click to verify. Premium costs $11.99 per month, billed yearly. The main advantage over Humata is the integration approach: rather than building everything into one platform, AskYourPDF lets you connect document AI to the tools you already use.",
+  "altsHumata.alt3Desc2": "Its pages list PDF, DOCX, EPUB, PPTX, RTF, TXT and CSV files and pasted URLs, and it says each answer cites the exact paragraph or page, with a click jumping to the highlighted source. Premium costs $14.99 per month, or $11.99 per month billed yearly. The main advantage over Humata is the integration approach: rather than building everything into one platform, AskYourPDF lets you connect document AI to the tools you already use.",
   "altsHumata.alt3BestFor": "Power users needing browser, Zotero, and API integrations",
   "altsHumata.alt4Title": "NotebookLM — Best Free Alternative",
   "altsHumata.alt4Desc1": "Google NotebookLM, now called Gemini Notebook, is the best free Humata alternative. Where Humata's free tier covers 60 pages per month, Gemini Notebook's free Standard tier allows 100 notebooks and 50 sources per notebook (with a Google account). A notebook can combine PDF, Word, PowerPoint, Google Docs, web URLs and YouTube videos, and Audio Overviews turn your sources into audio summaries.",
@@ -1849,7 +1850,7 @@
   "altsHumata.faq3Question": "Which Humata alternative has team features?",
   "altsHumata.faq3Answer": "Most alternatives on this list focus on individual users. If you need team collaboration, Humata's Team plan ($49/user/month, up to 10 users) remains a strong option. AskYourPDF also offers an Enterprise plan with custom pricing.",
   "altsHumata.faq4Question": "Which alternative supports the most file formats?",
-  "altsHumata.faq4Answer": "Gemini Notebook (formerly NotebookLM) accepts the widest range of sources on this list, including Word, PowerPoint, PDF, CSV and ePub files, web URLs and YouTube videos. DocTalk reads 7 formats, including Excel. AskYourPDF reads PDF, DOCX, EPUB, TXT and URLs, ChatPDF reads PDF, Word, PowerPoint, Markdown and text, and PDF.ai reads only PDF. Humata's site does not list its file types.",
+  "altsHumata.faq4Answer": "Gemini Notebook (formerly NotebookLM) accepts the widest range of sources on this list, including Word, PowerPoint, PDF, CSV and ePub files, web URLs and YouTube videos. DocTalk reads 7 formats, including Excel. AskYourPDF's pages list PDF, DOCX, EPUB, PPTX, RTF, TXT, CSV and URLs, ChatPDF reads PDF, Word, PowerPoint, Markdown and text, and PDF.ai reads only PDF. Humata's site does not list its file types.",
   "altsHumata.faq5Question": "Can any Humata alternative handle video files?",
   "altsHumata.faq5Answer": "Gemini Notebook (formerly NotebookLM) accepts public YouTube videos as sources. DocTalk does not support video. We could not confirm that Humata itself supports video, because its site does not list supported file types (checked October 2026).",
   "altsHumata.relatedPages": "Related Pages",
@@ -2053,7 +2054,7 @@
   "compareAskyourpdf.quickComparison": "Quick Comparison",
   "compareAskyourpdf.featureSupportedFormats": "Supported Formats",
   "compareAskyourpdf.featureSupportedFormatsDocTalk": "7 (PDF, DOCX, PPTX, XLSX, TXT, MD, URL)",
-  "compareAskyourpdf.featureSupportedFormatsCompetitor": "PDF, DOCX, EPUB, TXT, URL",
+  "compareAskyourpdf.featureSupportedFormatsCompetitor": "PDF, DOCX, EPUB, PPTX, RTF, TXT, CSV, URL",
   "compareAskyourpdf.featureCitationHighlighting": "Citation Highlighting",
   "compareAskyourpdf.featureChromeExtension": "Chrome Extension",
   "compareAskyourpdf.featureZoteroPlugin": "Zotero Plugin",
@@ -2072,22 +2073,22 @@
   "compareAskyourpdf.whatIsDocTalkTitle": "What Is DocTalk?",
   "compareAskyourpdf.whatIsDocTalkDescription": "DocTalk is an AI document Q&A platform that supports seven file formats: PDF, DOCX, PPTX, XLSX, TXT, Markdown, and web URLs. Its standout feature is clickable citations: click a citation in an AI answer to scroll to the source in your document and see the cited passage highlighted. The interface is available in 11 languages, and two AI performance modes (Flash and Pro) let you choose the right tradeoff between speed and depth. DocTalk is built for anyone who needs to verify AI answers against original sources, from students writing papers to lawyers reviewing contracts.",
   "compareAskyourpdf.whatIsAskyourpdfTitle": "What Is AskYourPDF?",
-  "compareAskyourpdf.whatIsAskyourpdfDescription": "AskYourPDF is an AI document chat tool with a wide set of integrations. According to its site (October 2026), it runs on the web, iOS and Android, as a Chrome extension, as a ChatGPT GPT and as a Zotero plugin, and it offers an API for developers. Its chat reader accepts PDF, DOCX, EPUB and TXT files or a pasted URL, and each answer cites the exact page, which you can click to verify. Its homepage now leads with a separate website-chatbot product; PDF chat has its own page.",
+  "compareAskyourpdf.whatIsAskyourpdfDescription": "AskYourPDF is an AI document chat tool with a wide set of integrations. According to its site (October 2026), it runs on the web, iOS and Android, as a Chrome extension, as a ChatGPT GPT and as a Zotero plugin, and it offers an API for developers. Its document pages list PDF, DOCX, EPUB, PPTX, RTF, TXT and CSV files; its chat-with-PDF page lists PDF, DOCX, EPUB and TXT files or a pasted URL. It says each answer cites the exact paragraph or page, and that clicking the citation jumps to the source and highlights it. Its homepage now leads with a separate website-chatbot product; PDF chat has its own page.",
   "compareAskyourpdf.featureByFeatureTitle": "Feature-by-Feature Comparison",
   "compareAskyourpdf.documentFormatTitle": "Document Format Support",
-  "compareAskyourpdf.documentFormatCompetitor": "AskYourPDF's chat reader accepts PDF, DOCX, EPUB and TXT files, and you can also paste a URL (checked October 2026). It does not list PowerPoint or Excel files for PDF chat.",
+  "compareAskyourpdf.documentFormatCompetitor": "AskYourPDF's own pages list different formats (checked October 2026): its PDF AI and document-chat pages list PDF, DOCX, EPUB, PPTX, RTF, TXT and CSV files, and its chat-with-PDF page lists PDF, DOCX, EPUB and TXT files or a pasted URL. None of them lists Excel (.xlsx) files.",
   "compareAskyourpdf.documentFormatDocTalk": "DocTalk natively supports seven formats with dedicated parsers for each: PDF with bounding-box citations, DOCX with full paragraph and table extraction, PPTX with slide structure and speaker notes, XLSX with spreadsheet cell preservation, TXT and Markdown with structure recognition, and web URLs with clean article extraction. Each parser is optimized for its format rather than converting everything through a single pipeline. See",
   "compareAskyourpdf.multiFormatLink": "multi-format support",
   "compareAskyourpdf.forDetails": "for details.",
   "compareAskyourpdf.citationsTitle": "AI Answer Quality & Citations",
-  "compareAskyourpdf.citationsCompetitor": "AskYourPDF says it returns each answer 'with a citation back to the exact page in the original PDF', and that you can click the citation to verify it. Its site does not say whether the cited passage is highlighted.",
+  "compareAskyourpdf.citationsCompetitor": "AskYourPDF says 'every answer includes a citation to the exact paragraph or page in your document', that clicking the citation jumps straight to the source, and that the source paragraph or page is highlighted.",
   "compareAskyourpdf.citationsDocTalk": "DocTalk also makes every citation clickable: click it and the document viewer scrolls to the cited passage and highlights it. When DocTalk cannot pinpoint the passage, it shows the cited page instead. For academic and legal work, where every claim must be traceable, this saves time. Learn more about",
   "compareAskyourpdf.citationHighlightingLink": "citation highlighting",
   "compareAskyourpdf.languageSupportTitle": "Language Support",
   "compareAskyourpdf.languageSupportCompetitor": "We did not verify which interface languages AskYourPDF offers, so this page makes no claim about them.",
   "compareAskyourpdf.languageSupportDocTalk": "DocTalk's interface is available in 11 languages: English, Chinese, Spanish, Japanese, German, French, Korean, Portuguese, Italian, Arabic, and Hindi. The AI answers in the language of your question.",
   "compareAskyourpdf.pricingTitle": "Pricing & Free Tier",
-  "compareAskyourpdf.pricingCompetitor": "AskYourPDF's free plan allows 1 document a day, 100 pages per document, 15 MB per file and 50 questions a day. Premium costs $11.99 per month and Pro $14.99 per month, both billed yearly; its pricing page does not show a monthly-billed price. An Enterprise plan has custom pricing (October 2026).",
+  "compareAskyourpdf.pricingCompetitor": "AskYourPDF's free plan allows 1 document a day, 100 pages per document, 15 MB per file and 50 questions a day. Premium costs $14.99 per month billed monthly, or $11.99 per month billed yearly; Pro costs $19.99 per month billed monthly, or $14.99 per month billed yearly. An Enterprise plan has custom pricing (October 2026).",
   "compareAskyourpdf.pricingDocTalkPart1": "DocTalk provides a",
   "compareAskyourpdf.noSignupDemoLink": "no-signup demo",
   "compareAskyourpdf.pricingDocTalkPart2": "for instant access, plus a free tier with 300 credits per month. The Plus plan ($9.99/month) includes 3,000 credits, unrestricted Pro mode, and export features. The Pro plan ($19.99/month) adds 9,000 credits and custom instructions. Credit packs are available for one-time top-ups. View",
@@ -2100,7 +2101,7 @@
   "compareAskyourpdf.securityDocTalk": "DocTalk implements AES-256 encryption, SSRF protection, magic-byte file validation, and GDPR compliance features including data export. No browser extensions are required, and documents are never used for AI training. The application runs in non-root Docker containers for additional security.",
   "compareAskyourpdf.whoDocTalkTitle": "Who Should Choose DocTalk?",
   "compareAskyourpdf.whoDocTalk1": "Users who need verifiable answers with one-click citation highlighting",
-  "compareAskyourpdf.whoDocTalk2": "People who work with PowerPoint or Excel files as well as PDF and Word",
+  "compareAskyourpdf.whoDocTalk2": "People who work with Excel files as well as PDF, Word and PowerPoint",
   "compareAskyourpdf.whoDocTalk3": "Non-English speakers who need a localized interface",
   "compareAskyourpdf.whoDocTalk4": "Users who prefer a clean, simple interface without browser extensions",
   "compareAskyourpdf.whoDocTalk5": "Anyone wanting to try before signing up, via the instant demo",
@@ -2111,21 +2112,21 @@
   "compareAskyourpdf.whoAskyourpdf4": "Power users who want to integrate document AI into complex research workflows",
   "compareAskyourpdf.verdictTitle": "Verdict",
   "compareAskyourpdf.verdictParagraph1": "AskYourPDF has built a wide ecosystem of integrations that makes it powerful for researchers and developers who want to embed document AI into their workflows: a Chrome extension, a Zotero plugin, mobile apps, a ChatGPT GPT and an API.",
-  "compareAskyourpdf.verdictParagraph2": "DocTalk takes a different approach: one web app that reads PowerPoint and Excel files as well as PDF and Word, and highlights the cited passage in your document. If your priority is traceable answers from mixed document formats, DocTalk is the better fit.",
-  "compareAskyourpdf.verdictParagraph3": "If you need integrations with Zotero, Chrome or your own code, evaluate AskYourPDF. If you need PowerPoint or Excel support or highlighted citations, DocTalk fits better. The best way to compare is to",
+  "compareAskyourpdf.verdictParagraph2": "DocTalk takes a different approach: one web app that reads Excel files as well as PDF, Word and PowerPoint, and highlights the cited passage in your document. If your priority is traceable answers from mixed document formats, including spreadsheets, DocTalk is the better fit.",
+  "compareAskyourpdf.verdictParagraph3": "If you need integrations with Zotero, Chrome or your own code, evaluate AskYourPDF. If you need Excel support, DocTalk fits better. The best way to compare is to",
   "compareAskyourpdf.tryDocTalkLink": "try DocTalk for free",
   "compareAskyourpdf.verdictParagraph3Mid": "and see the citation highlighting in action. You might also be interested in our",
   "compareAskyourpdf.chatpdfComparisonLink": "DocTalk vs ChatPDF",
   "compareAskyourpdf.verdictParagraph3End": "comparison.",
   "compareAskyourpdf.faqTitle": "Frequently Asked Questions",
   "compareAskyourpdf.faq1Question": "Is DocTalk better than AskYourPDF?",
-  "compareAskyourpdf.faq1Answer": "It depends on your needs. DocTalk reads 7 formats, including PowerPoint and Excel, and highlights the cited passage in your document. AskYourPDF offers more integrations, including a Chrome extension, a Zotero plugin, mobile apps and API access. If you value citation highlighting and format coverage, DocTalk is the better choice. If you need browser integrations or API access, AskYourPDF has the edge.",
+  "compareAskyourpdf.faq1Answer": "It depends on your needs. DocTalk reads 7 formats, including Excel, and highlights the cited passage in your document. AskYourPDF offers more integrations, including a Chrome extension, a Zotero plugin, mobile apps and API access. If you work with Excel files, DocTalk is the better choice. If you need browser integrations or API access, AskYourPDF has the edge.",
   "compareAskyourpdf.faq2Question": "Does AskYourPDF support citation highlighting?",
-  "compareAskyourpdf.faq2Answer": "AskYourPDF says each answer cites the exact page in the original PDF, and you can click the citation to verify it. Its site does not say whether the cited passage is highlighted. When you click a citation, DocTalk scrolls to the cited passage in your document and highlights it.",
+  "compareAskyourpdf.faq2Answer": "AskYourPDF says it does: each answer cites the exact paragraph or page, clicking the citation jumps to the source, and the source is highlighted. When you click a citation, DocTalk scrolls to the cited passage in your document and highlights it.",
   "compareAskyourpdf.faq3Question": "Which tool is easier to use?",
   "compareAskyourpdf.faq3Answer": "DocTalk is one web app with a focused interface, and its demo needs no signup. AskYourPDF offers more apps and integrations, so there is more to choose from. Try both on a short document to see which suits you.",
   "compareAskyourpdf.faq4Question": "Can AskYourPDF handle non-PDF documents?",
-  "compareAskyourpdf.faq4Answer": "Yes. AskYourPDF's chat reader accepts PDF, DOCX, EPUB and TXT files, and you can paste a URL (October 2026). DocTalk reads 7 formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL) with a dedicated parser for each, including PowerPoint and Excel.",
+  "compareAskyourpdf.faq4Answer": "Yes. AskYourPDF's PDF AI and document-chat pages list DOCX, EPUB, PPTX, RTF, TXT and CSV files as well as PDF, and its chat-with-PDF page also takes a pasted URL (October 2026). None of its pages lists Excel (.xlsx) files. DocTalk reads 7 formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL) with a dedicated parser for each, including Excel.",
   "compareAskyourpdf.relatedPages": "Related Pages",
   "compareAskyourpdf.linkCitationHighlighting": "Citation Highlighting",
   "compareAskyourpdf.linkMultiFormat": "Multi-Format Support",
@@ -2133,7 +2134,7 @@
   "compareAskyourpdf.linkPricing": "Pricing",
   "compareAskyourpdf.linkChatpdfComparison": "DocTalk vs ChatPDF",
   "compareAskyourpdf.ctaTitle": "Try DocTalk Free — No Signup Required",
-  "compareAskyourpdf.ctaDescription": "See how citation highlighting compares to page references. Open a sample document and try it now.",
+  "compareAskyourpdf.ctaDescription": "See how DocTalk highlights the cited passage. Open a sample document and try it now.",
   "compareAskyourpdf.ctaButton": "Try the Demo",
   "useCasesStudents.breadcrumb.home": "Home",
   "useCasesStudents.breadcrumb.useCases": "Use Cases",
@@ -2832,7 +2833,7 @@
   "pricing.pro.meter": "Power usage",
   "altsAskyourpdf.tableFileFormats": "File Formats",
   "altsAskyourpdf.table7Formats": "7 formats (PDF, DOCX, PPTX, XLSX, TXT, MD, URL)",
-  "altsAskyourpdf.tablePdfOnly": "PDF, DOCX, EPUB, TXT, URL",
+  "altsAskyourpdf.tablePdfOnly": "PDF, DOCX, EPUB, PPTX, RTF, TXT, CSV, URL",
   "altsAskyourpdf.tableCitationHighlighting": "Citation Highlighting",
   "altsAskyourpdf.tableLanguages": "Languages",
   "altsAskyourpdf.tableFreeTier": "Free Tier",
@@ -2843,11 +2844,11 @@
   "altsAskyourpdf.faq1Question": "What is the best free AskYourPDF alternative?",
   "altsAskyourpdf.faq1Answer": "Google NotebookLM, now called Gemini Notebook, has a free Standard tier with usage limits (100 notebooks, 50 sources per notebook) and creates Audio Overviews. DocTalk also offers a free demo with no signup and a free tier with 300 credits per month, making both strong options for users looking to switch from AskYourPDF without paying.",
   "altsAskyourpdf.faq2Question": "Why do people switch from AskYourPDF to other tools?",
-  "altsAskyourpdf.faq2Answer": "Reasons vary. AskYourPDF's chat reader does not list PowerPoint or Excel files, and its site does not say whether cited passages are highlighted. Its paid plans are priced per month but billed yearly ($11.99 for Premium), and the monthly-billed price is not shown.",
+  "altsAskyourpdf.faq2Answer": "Reasons vary. None of AskYourPDF's pages lists Excel files, its free plan allows 1 document a day, and Premium costs $14.99 per month billed monthly ($11.99 per month billed yearly).",
   "altsAskyourpdf.faq3Question": "Which AskYourPDF alternative supports the most document formats?",
-  "altsAskyourpdf.faq3Answer": "Gemini Notebook (formerly NotebookLM) accepts the widest range of sources on this list, from Word, PowerPoint and ePub files to web URLs and YouTube videos. DocTalk reads 7 formats, including PowerPoint and Excel. AskYourPDF reads PDF, DOCX, EPUB, TXT and URLs.",
+  "altsAskyourpdf.faq3Answer": "Gemini Notebook (formerly NotebookLM) accepts the widest range of sources on this list, from Word, PowerPoint and ePub files to web URLs and YouTube videos. DocTalk reads 7 formats, including PowerPoint and Excel. AskYourPDF's pages list PDF, DOCX, EPUB, PPTX, RTF, TXT, CSV and URLs.",
   "altsAskyourpdf.faq4Question": "Is there an AskYourPDF alternative with better citation accuracy?",
-  "altsAskyourpdf.faq4Answer": "DocTalk scrolls to the cited passage in your document and highlights it. AskYourPDF already cites the exact page and lets you click the citation to verify it; its site does not say whether the passage is highlighted. ChatDOC also documents clickable page numbers.",
+  "altsAskyourpdf.faq4Answer": "DocTalk scrolls to the cited passage in your document and highlights it, and Quote Finder checks quotes against the source text. AskYourPDF says it cites the exact paragraph or page, jumps there when you click the citation and highlights the source. ChatDOC also documents clickable page numbers.",
   "altsAskyourpdf.faq5Question": "Which AskYourPDF alternative is best for academic research?",
   "altsAskyourpdf.faq5Answer": "For academic research, Consensus is excellent for searching across published papers. DocTalk is best for analyzing specific documents with verifiable citations. NotebookLM is ideal for free multi-source literature reviews with audio summaries.",
   "altsAskyourpdf.chooseNeed1": "Multi-format support + citation highlighting",
@@ -2862,29 +2863,29 @@
   "altsAskyourpdf.breadcrumbAskyourpdf": "AskYourPDF",
   "altsAskyourpdf.heroTitle": "7 Best AskYourPDF Alternatives in 2026",
   "altsAskyourpdf.metaTitle": "7 Best AskYourPDF Alternatives in 2026",
-  "altsAskyourpdf.heroDescription": "AskYourPDF is an AI PDF chat tool with many integrations. Its chat reader accepts PDF, DOCX, EPUB and TXT files or a URL, but it does not list PowerPoint or Excel files. Whether you need those formats, citations highlighted in the original document, or a different pricing model, these 7 alternatives offer options for every use case.",
+  "altsAskyourpdf.heroDescription": "AskYourPDF is an AI PDF chat tool with many integrations. Its pages list PDF, Word, EPUB, PowerPoint, RTF, text and CSV files and pasted URLs, but none lists Excel files. Whether you need Excel support, team features, a free research notebook or a different pricing model, these 7 alternatives offer options for every use case.",
   "altsAskyourpdf.metaDescription": "The 7 best AskYourPDF alternatives in 2026, compared on file formats, citation style, free plans and published prices.",
   "altsAskyourpdf.compareTitle": "DocTalk vs AskYourPDF at a Glance",
   "altsAskyourpdf.whyTitle": "Why Look for AskYourPDF Alternatives?",
   "altsAskyourpdf.whyIntro": "AskYourPDF is a solid tool for PDF Q&A with many integrations, but some needs take you elsewhere:",
-  "altsAskyourpdf.whyReason1": "Format coverage — AskYourPDF's chat reader accepts PDF, DOCX, EPUB and TXT files and URLs, but it does not list PowerPoint or Excel files.",
-  "altsAskyourpdf.whyReason2": "Citation style — AskYourPDF cites the exact page and lets you click to verify, but its site does not say whether the passage is highlighted. DocTalk highlights the cited passage in the original document.",
+  "altsAskyourpdf.whyReason1": "Format coverage — AskYourPDF's pages list PDF, DOCX, EPUB, PPTX, RTF, TXT and CSV files and URLs, but none lists Excel (.xlsx) files. DocTalk reads Excel files natively.",
+  "altsAskyourpdf.whyReason2": "Checking quotes — AskYourPDF says each answer cites the exact paragraph or page and highlights the source. DocTalk highlights the cited passage too, and its Quote Finder shows only quotes checked against the source text, with the page they come from.",
   "altsAskyourpdf.whyReason3": "Free-plan limits — The free plan allows 1 document a day, up to 100 pages and 15 MB per document, and 50 questions a day.",
-  "altsAskyourpdf.whyReason4": "Pricing — Premium costs $11.99 per month billed yearly, and the pricing page does not show a monthly-billed price. DocTalk Plus costs $9.99 per month, billed monthly.",
+  "altsAskyourpdf.whyReason4": "Pricing — Premium costs $14.99 per month billed monthly, or $11.99 per month billed yearly. DocTalk Plus costs $9.99 per month, billed monthly.",
   "altsAskyourpdf.alt1Title": "DocTalk",
   "altsAskyourpdf.bestOverall": "Best Overall AskYourPDF Alternative",
-  "altsAskyourpdf.alt1Desc1": "DocTalk is the top alternative to AskYourPDF for users who want highlighted citations and broader format support: it reads 7 document types (PDF, DOCX, PPTX, XLSX, TXT, Markdown, and URLs), including PowerPoint and Excel. Its standout feature is citation highlighting: clicking a citation highlights the cited passage in the source document.",
+  "altsAskyourpdf.alt1Desc1": "DocTalk is the top alternative to AskYourPDF for users who want highlighted citations and Excel support: it reads 7 document types (PDF, DOCX, PPTX, XLSX, TXT, Markdown, and URLs), including Excel. Its standout feature is citation highlighting: clicking a citation highlights the cited passage in the source document.",
   "altsAskyourpdf.alt1Desc2": "DocTalk also supports 11 interface languages, offers a free demo with no signup required, and provides two AI performance modes (Flash and Pro) so you can optimize for speed or accuracy. It has no browser extension, Zotero plugin or public API, so AskYourPDF remains stronger on integrations.",
   "altsAskyourpdf.alt1Desc3Pre": "See our",
   "altsAskyourpdf.alt1CompareLink": "detailed DocTalk vs AskYourPDF comparison",
   "altsAskyourpdf.alt1Desc3Post": "for a feature-by-feature breakdown.",
   "altsAskyourpdf.keyAdvantages": "Key Advantages",
-  "altsAskyourpdf.adv1": "7 document formats, including PowerPoint and Excel",
+  "altsAskyourpdf.adv1": "7 document formats, including Excel",
   "altsAskyourpdf.adv2": "Real-time citation highlighting with visual verification",
   "altsAskyourpdf.adv3": "11 languages supported natively",
   "altsAskyourpdf.adv4": "Free demo with no signup required",
   "altsAskyourpdf.adv5": "Two AI modes: Flash and Pro",
-  "altsAskyourpdf.adv6": "Starting at $9.99/mo (AskYourPDF Premium: $11.99/mo billed yearly)",
+  "altsAskyourpdf.adv6": "Starting at $9.99/mo (AskYourPDF Premium: $14.99/mo, or $11.99/mo billed yearly)",
   "altsAskyourpdf.bestFor": "Best for:",
   "altsAskyourpdf.alt2Title": "ChatPDF",
   "altsAskyourpdf.alt2Desc1": "ChatPDF offers a clean, simple interface for asking questions about documents, and you can start without an account. It reads PDF, Word, PowerPoint, Markdown and text files, and its citations scroll to the source.",
@@ -2991,7 +2992,7 @@
   "altsPdfai.alt2BestFor": "Users who want a simple document chat tool with no account needed.",
   "altsPdfai.alt3Title": "AskYourPDF",
   "altsPdfai.alt3Desc1": "AskYourPDF differentiates itself with a Zotero integration for academic workflows and API access for developers. If you're switching from PDF.ai and need research tool integrations, AskYourPDF fills that gap well.",
-  "altsPdfai.alt3Desc2Pre": "AskYourPDF also reads DOCX, EPUB and TXT files and URLs, and it is available as a Chrome extension, a ChatGPT GPT and mobile apps. Each answer cites the exact page. See our",
+  "altsPdfai.alt3Desc2Pre": "AskYourPDF's pages also list DOCX, EPUB, PPTX, RTF, TXT and CSV files and pasted URLs, and it is available as a Chrome extension, a ChatGPT GPT and mobile apps. It says each answer cites the exact paragraph or page. See our",
   "altsPdfai.alt3CompareLink": "AskYourPDF comparison",
   "altsPdfai.alt3BestFor": "Researchers who need Zotero integration and API access for automated workflows.",
   "altsPdfai.alt4Title": "Humata",
-  "compareAskyourpdf.faq2Question": "Does AskYourPDF support destaque de citação?",
+  "compareAskyourpdf.faq2Question": "O AskYourPDF oferece destaque de citação?",
-  "compareAskyourpdf.verdictParagraph3Mid": "and see the destaque de citação in action. You might also be interested in our",
+  "compareAskyourpdf.verdictParagraph3Mid": "e veja o destaque de citação em ação. Você também pode se interessar pela nossa",
```
