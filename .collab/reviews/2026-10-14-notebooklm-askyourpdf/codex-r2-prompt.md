# Codex r2: AskYourPDF facts in notebooklm-alternatives-2026.md (DocTalk, 2026-10-14)

Do NOT run git. Repo root = cwd. Your r1 brief and verdict: `codex-r1-prompt.md`, `codex-r1-output.md` in
`.collab/reviews/2026-10-14-notebooklm-askyourpdf/`. Source of record: `evidence.md` there (now with "Audio" and
"API and history" sections added after your r1). The full diff (base 2f2a9eaf → working tree) is pasted below.

## How your r1 findings were handled

1. SHOULD audio — accepted. The executor fetched the Chrome Web Store listing ("PodcastAnywhere by AskYourPDF - Turn
   your documents into podcasts…", "Created by the owner of the listed website", v1.0.1, updated March 18, 2025) and
   the vendor tutorial ("convert written content into audio conversations"). It is not in AskYourPDF's product list,
   so it is described as a separate extension: table cell "Separate extension (PodcastAnywhere)"; :148 now "You want
   audio overviews built in. Of the alternatives here, only AskYourPDF offers podcast-style audio, through a separate
   Chrome extension (PodcastAnywhere)." Your suggested "Vendor documents PDF-to-podcast via PodAnywhere" was not used
   verbatim: the store and the extension name it PodcastAnywhere; the blog URL says "podanywhere".
2. NIT formats — accepted verbatim in substance: "AskYourPDF's own pages list different sets of formats: …".
3. NIT history — accepted: "began as a ChatGPT plugin" removed (no vendor page says "began as"); the sentence now
   reads "is a standalone app with a developer API", sourced to docs.askyourpdf.com ("Introducing the AskYourPDF API").
Also: the two check-date sentences now say "AskYourPDF's prices and features were checked again on 14 October 2026"
(they now cover audio too).

## Check

1. Each r1 fix is correct, sourced in evidence.md, and not stronger than the vendor's words.
2. Nothing else in the post now contradicts the change (the DocTalk and ChatPDF "no audio overviews" lines at :53,
   :61, :73 are about those tools; say if any is now misleading).
3. Markdown: 7-column table rows; `frontend/tests/blog-jsonld.test.cjs` (executor ran it: 7/7).
Output numbered findings (BLOCKER / SHOULD / NIT, file:line, fix). Final line: SHIP / SHIP-WITH-FIXES / REWORK.

## The diff

```diff
diff --git a/frontend/content/blog/notebooklm-alternatives-2026.md b/frontend/content/blog/notebooklm-alternatives-2026.md
index fce44485..c0582e93 100644
--- a/frontend/content/blog/notebooklm-alternatives-2026.md
+++ b/frontend/content/blog/notebooklm-alternatives-2026.md
@@ -2,7 +2,7 @@
 title: "5 Best NotebookLM Alternatives in 2026"
 description: "NotebookLM is now Gemini Notebook. Five alternatives compared on formats, how you check an answer, and current pricing: DocTalk, ChatPDF, AskYourPDF, Humata and PDF.ai. Prices checked 30 September 2026."
 date: "2026-03-18"
-updated: "2026-10-12"
+updated: "2026-10-14"
 author: "DocTalk Team"
 category: "comparisons"
 tags: ["notebooklm", "gemini notebook", "alternatives", "comparison", "ai tools", "google", "document chat"]
@@ -18,7 +18,7 @@ keywords: ["notebooklm alternative", "notebooklm alternatives 2026", "google not
 > - **ChatPDF** reads Word, PowerPoint, Markdown and text files as well as PDFs, and its citations scroll to the source.
 > - **AskYourPDF**, **Humata** and **PDF.ai** changed their plans; the prices below are current.
 
-**How we compiled this:** prices, limits and supported formats come from each vendor's own pricing and help pages, read on 30 September 2026. Where we relied on third-party reviews, we say so. Plans change often, so check before you buy.
+**How we compiled this:** prices, limits and supported formats come from each vendor's own pricing and help pages, read on 30 September 2026; AskYourPDF's prices and features were checked again on 14 October 2026. Where we relied on third-party reviews, we say so. Plans change often, so check before you buy.
 
 ## What Gemini Notebook (NotebookLM) Does Well
 
@@ -82,16 +82,17 @@ Any replacement should match these strengths, or have a good reason not to:
 
 ### 3. AskYourPDF — Best for Large PDFs
 
-[AskYourPDF](https://askyourpdf.com) began as a ChatGPT plugin and is now a standalone app and API; it is also reported to offer a Chrome extension and a Zotero integration.
+[AskYourPDF](https://askyourpdf.com) is a standalone app with a developer API. It runs on the web, iOS and Android, and as a Chrome extension, a ChatGPT GPT and a Zotero plugin.
 
-**How it compares to Gemini Notebook:** built around PDFs, with very large page allowances on paid plans (2,500 pages per document on Premium, 6,000 on Pro).
+**How it compares to Gemini Notebook:** built around PDFs, with very large page allowances on paid plans (2,500 pages per document on Premium, 6,000 on Pro). AskYourPDF's own pages list different sets of formats: its PDF AI and document-chat pages list DOCX, EPUB, PPTX, RTF, TXT and CSV files, while its chat-with-PDF page lists DOCX, EPUB and TXT files or a pasted URL.
 
 **Key differences:**
 - Very large per-document page limits on paid plans
-- Developer API; Zotero and Chrome integrations per third-party reviews
+- AskYourPDF says each answer cites "the exact paragraph or page", that clicking the citation jumps to the source, and that the source is highlighted
+- Developer API; Zotero plugin and Chrome extension
 - Tight free plan: 1 document a day (100 pages, 15 MB), 50 questions a day
 
-**Pricing:** Free (limits above). Premium: $11.99/month. Pro: $14.99/month. Enterprise: custom. See [DocTalk vs AskYourPDF](/compare/askyourpdf).
+**Pricing:** Free (limits above). Premium: $14.99/month, or $11.99/month billed yearly. Pro: $19.99/month, or $14.99/month billed yearly. Enterprise: custom. See [DocTalk vs AskYourPDF](/compare/askyourpdf).
 
 **Best for:** researchers with long PDFs.
 
@@ -127,16 +128,16 @@ Any replacement should match these strengths, or have a good reason not to:
 
 ## Comparison Table
 
-Checked 30 September 2026 on each vendor's own site unless marked.
+Checked 30 September 2026 on each vendor's own site unless marked; AskYourPDF's prices and features checked again 14 October 2026.
 
 | Feature | Gemini Notebook | DocTalk | ChatPDF | AskYourPDF | Humata | PDF.ai |
 |---|---|---|---|---|---|---|
 | **Free tier** | 100 notebooks, 50 sources each | 500 starter, then 300 credits/mo | 2 docs/day | 1 doc/day | 60 pages/mo | 1 upload/mo |
-| **Paid from** | Google AI plans | $9.99/mo | Not published | $11.99/mo | $9.99/mo | $10/mo (yearly) |
-| **Word / PowerPoint** | Yes / Yes | Yes / Yes | Yes / Yes | —¹ / Yes¹ | —¹ | No¹ |
-| **Excel** | Sheets or CSV | Native .xlsx | No | No | —¹ | No |
-| **How you check an answer** | Inline citation | Passage highlighted in the file | Scrolls to source | Page-level reference¹ | Link to file | Text reference¹ |
-| **Audio overviews** | Yes | No | No | No | No | No |
+| **Paid from** | Google AI plans | $9.99/mo | Not published | $11.99/mo (yearly) | $9.99/mo | $10/mo (yearly) |
+| **Word / PowerPoint** | Yes / Yes | Yes / Yes | Yes / Yes | Yes / Yes | —¹ | No¹ |
+| **Excel** | Sheets or CSV | Native .xlsx | No | CSV | —¹ | No |
+| **How you check an answer** | Inline citation | Passage highlighted in the file | Scrolls to source | Paragraph or page cited; vendor says a click jumps there and highlights it | Link to file | Text reference¹ |
+| **Audio overviews** | Yes | No | No | Separate extension (PodcastAnywhere) | No | No |
 | **Google account needed** | Yes | No | No | No | No | No |
 
 ¹ From third-party reviews. "—" means we could not confirm it.
@@ -144,7 +145,7 @@ Checked 30 September 2026 on each vendor's own site unless marked.
 ## When Gemini Notebook Is Still the Best Choice
 
 - **You want the largest free allowance.** 100 notebooks with 50 sources each is generous.
-- **You want audio overviews.** None of the alternatives here offer them.
+- **You want audio overviews built in.** Of the alternatives here, only AskYourPDF offers podcast-style audio, through a separate Chrome extension (PodcastAnywhere).
 - **You live in Google Workspace.** Drive, Docs and Sheets integration is seamless.
 - **You synthesise across many sources.** Notebooks are built for that.
 
```
