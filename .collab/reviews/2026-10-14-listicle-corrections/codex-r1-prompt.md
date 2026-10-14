# Codex fact-check: vendor-sourced corrections in two listicles (DocTalk, 2026-10-14)

Do NOT run git. Repo root = cwd. The diff under review is pasted at the end of this prompt.

## Why these two posts changed

`best-ai-pdf-tools-2026.md` and `chatpdf-alternatives-2026.md` were frozen until an 11-07 read. Fable
(the planner) unfroze them on 2026-10-14 for fact corrections only. Read the ruling:
`.collab/dialogue/2026-10-14-fable-readout-rulings.md` (section Q1 and executor step 2). Its rules:
- Apply every row of `.collab/reviews/2026-10-10-step5-page-citations/vendor-evidence.md` §3 for these two
  files, plus `.collab/reviews/2026-10-12-highlight-claims-all-formats/claims.md` §D Q1 and Q2.
- Unchanged: title, description, headings, tool order, Short answer, Verdict.
- Drop footnote ¹ where a cell becomes vendor-sourced.
- The check-date sentences (best-ai-pdf-tools lines 34 and 171) name the second check date: 10 October 2026,
  if the vendor pages are unchanged. `updated` = ship date (2026-10-14). English only.
- `best-ai-tools-academic-research-2026.md` and `ai-pdf-readers-page-number-citations-2026.md` stay frozen:
  confirm the diff does not touch them.

## Executor's notes for you to check

1. **Re-check on 2026-10-14.** The executor reopened the vendor pages in a browser on 2026-10-14 and found
   every quote used below still present: AskYourPDF chat-with-pdf (formats "PDF, DOCX, EPUB, or TXT ... or
   paste a URL"; "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin"; "a citation back
   to the exact page in the original PDF. Click the citation to verify."), Humata homepage ("Highlights
   citations"), Gemini Notebook help ("To navigate directly to the quote and review it in context, select a
   citation."), ChatDOC guide (page numbers + "Click the page number to jump"; "2 files every 24 hours",
   "20 pages"), pdf.ai/faq ("You can only upload PDF (.pdf) files at the moment."; "with cited sources").
   Your sandbox may have no network: treat vendor-evidence.md §2 as the source of record, and flag any edit
   whose wording the §2 quotes do not support.
2. **Second check date in chatpdf-alternatives.** Fable named only lines 34 and 171 of best-ai-pdf-tools.
   chatpdf-alternatives has the equivalent sentences at lines 25 and 190; the executor applied the same rule
   there. Say whether that is right.
3. **Footnote ¹ kept** in best-ai-pdf-tools for the three Humata cells (Word, PowerPoint, Excel "—¹") and
   footnote line 185, because vendor-evidence §2.10 says Humata's formats are not stated on any vendor page
   checked. Check that every remaining ¹ is still third-party-sourced and that no vendor-sourced cell kept one.
4. **"Exact" wording not edited.** best-ai-pdf-tools lines 14, 29, 199, 216 and chatpdf-alternatives lines 14,
   29, 216 still say "exact passage" / "exact page". Lines 14 and 216 are the Short answer / verdict (locked
   by the ruling). claims.md "Verdict rules" rule 3 bans "exact passage" next to a highlight verb only in
   changed sentences, and claims.md §D lists best-ai-pdf-tools :199 as read and acceptable. Say whether any of
   these is false as a claim about DocTalk (product truth: claims.md "Product truth" and .claude/rules/frontend.md
   strategy ④: when DocTalk cannot pinpoint the passage it shows the cited page). If one is false, say whether
   it is false enough to break the "Short answer unchanged" rule; the executor will escalate, not edit.

## Check, adversarially

1. Every changed competitor sentence and table cell against vendor-evidence.md §2 (and §3's "Vendor says
   today" column). Flag: wording stronger than the quote (e.g. "jumps to the quote" vs the vendor's own words;
   "highlights" where the vendor only says "Highlights citations" with no object), quotes that are not verbatim
   in §2, and any §3 row for these two files that was NOT applied.
2. Unchanged neighbours that the changes now contradict (e.g. a prose paragraph that still says
   "per third-party reviews", "page-level text citations", "PDF-first", "we could not confirm passage-level
   highlighting", "links individual data points" for a fact the diff made vendor-sourced). Grep both files.
3. The ChatDOC free-limit sentence: the vendor contradicts itself; the post should cite the homepage table and
   date it, without picking a side silently. Check both the prose and the table cell.
4. DocTalk claims touched by the diff (claims.md §D Q1/Q2): the highlight is "the cited passage".
5. Fairness: no edit may disparage a competitor beyond the vendor's own words.
6. Markdown: table column counts, footnote markers, quotes and apostrophes, frontmatter `updated`.

Output numbered findings with severity (BLOCKER / SHOULD / NIT), file:line, and a concrete fix.
Final line: SHIP / SHIP-WITH-FIXES / REWORK.

## The diff

```diff
diff --git a/frontend/content/blog/best-ai-pdf-tools-2026.md b/frontend/content/blog/best-ai-pdf-tools-2026.md
index 5bbc0c09..d23ae280 100644
--- a/frontend/content/blog/best-ai-pdf-tools-2026.md
+++ b/frontend/content/blog/best-ai-pdf-tools-2026.md
@@ -2,7 +2,7 @@
 title: "7 Best AI PDF Tools in 2026: A Detailed Comparison"
 description: "The top AI PDF chat tools of 2026 compared on formats, citations and current pricing: DocTalk, ChatPDF, AskYourPDF, Gemini Notebook (formerly NotebookLM), Humata, PDF.ai and ChatDOC. Prices checked 30 September 2026."
 date: "2026-02-18"
-updated: "2026-10-10"
+updated: "2026-10-14"
 author: "DocTalk Team"
 category: "comparisons"
 tags: ["comparison", "ai tools", "pdf", "chatpdf", "notebooklm", "review"]
@@ -31,7 +31,7 @@ We compared each tool on five points:
 4. **Free tier and price** — what you can do for free, and what paid plans cost.
 5. **Extras** — team features, browser extensions, audio summaries and so on.
 
-Prices, limits and supported formats come from each vendor's own pricing and help pages, read on 30 September 2026. Where we relied on third-party reviews instead, we say so. Plans change often, so check the vendor before you buy.
+Prices, limits and supported formats come from each vendor's own pricing and help pages, read on 30 September 2026; formats and citation features were checked again on 10 October 2026. Where we relied on third-party reviews instead, we say so. Plans change often, so check the vendor before you buy.
 
 ## The 7 Best AI PDF Tools
 
@@ -80,12 +80,12 @@ For a closer look, see [DocTalk vs ChatPDF](/compare/chatpdf).
 
 ### 3. [AskYourPDF](https://askyourpdf.com) — Best for Researchers
 
-**What it does:** document chat for academic workflows, with an API; it is also reported to offer a Chrome extension and a Zotero integration.
+**What it does:** document chat for academic workflows, with an API. It runs on the web, iOS and Android, and as a Chrome extension, a ChatGPT GPT and a Zotero plugin.
 
-**Why it stands out:** paid plans allow very long documents, and third-party reviews describe a Zotero integration for querying a reference library.
+**Why it stands out:** paid plans allow very long documents, and a Zotero plugin brings it to researchers who keep their papers there.
 
 **Key features:**
-- Chrome extension and Zotero integration (per third-party reviews)
+- Chrome extension and Zotero plugin
 - API for developers
 - Up to 2,500 pages per document on Premium and 6,000 on Pro
 
@@ -93,7 +93,7 @@ For a closer look, see [DocTalk vs ChatPDF](/compare/chatpdf).
 
 **Best for:** PhD students and researchers with large paper collections.
 
-**Limitations:** tight free plan; references are page-level text citations rather than highlighted passages (per third-party reviews).
+**Limitations:** tight free plan; each answer cites the page it came from and you click the citation to check it, but AskYourPDF does not say it highlights the passage.
 
 ### 4. [Gemini Notebook](https://notebook.google) (formerly NotebookLM) — Best Free Option
 
@@ -130,7 +130,7 @@ See our [DocTalk vs NotebookLM](/compare/notebooklm) comparison.
 
 **Best for:** small teams, consultancies and research groups sharing documents.
 
-**Limitations:** small free allowance; we could not confirm passage-level highlighting.
+**Limitations:** small free allowance; Humata says it "highlights citations" but does not say what is highlighted or where.
 
 ### 6. [PDF.ai](https://pdf.ai) — Simplest Interface
 
@@ -147,7 +147,7 @@ See our [DocTalk vs NotebookLM](/compare/notebooklm) comparison.
 
 **Best for:** occasional PDF questions with no setup.
 
-**Limitations:** PDF-focused (third-party reviews report no native Word or PowerPoint chat); small free plan.
+**Limitations:** PDF only ("You can only upload PDF (.pdf) files at the moment", per its FAQ); small free plan.
 
 ### 7. [ChatDOC](https://chatdoc.com) — Best for Tables and Data
 
@@ -160,7 +160,7 @@ See our [DocTalk vs NotebookLM](/compare/notebooklm) comparison.
 - Pro adds Word, scanned files, EPUB, Markdown, text and web pages, plus formula recognition and file translation
 - Unlimited OCR on Pro
 
-**Pricing:** Free: 5 files a day (10 in total), 20 questions a day, up to 300 pages and 60 MB per file, PDF only. Pro: $8.99 per 30 days, or $89.90 per 360 days.
+**Pricing:** Free: 5 files a day (10 in total), 20 questions a day, up to 300 pages and 60 MB per file, PDF only. Pro: $8.99 per 30 days, or $89.90 per 360 days. The free limits are from ChatDOC's homepage pricing table on 10 October 2026; its own guide and FAQ say 2 files per 24 hours and 20 pages per file.
 
 **Best for:** data-heavy PDFs.
 
@@ -168,16 +168,16 @@ See our [DocTalk vs NotebookLM](/compare/notebooklm) comparison.
 
 ## Master Comparison Table
 
-Checked 30 September 2026 on each vendor's own site unless noted.
+Checked 30 September 2026 on each vendor's own site unless noted; formats and citation features checked again 10 October 2026.
 
 | Feature | DocTalk | ChatPDF | AskYourPDF | Gemini Notebook | Humata | PDF.ai | ChatDOC |
 |---|---|---|---|---|---|---|---|
 | **PDF** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
-| **Word** | Yes | Yes | —¹ | Yes | —¹ | No¹ | Pro |
-| **PowerPoint** | Yes | Yes | Yes¹ | Yes | —¹ | No¹ | — |
+| **Word** | Yes | Yes | Yes | Yes | —¹ | No | Pro |
+| **PowerPoint** | Yes | Yes | — | Yes | —¹ | No | — |
 | **Excel** | Yes | No | No | Sheets/CSV | —¹ | No | — |
-| **Web URL** | Yes | Yes | — | Yes | — | No | Pro |
-| **How you check** | Passage highlighted | Scrolls to source | Page reference¹ | Inline citation | Link to file | Text reference¹ | TapSource |
+| **Web URL** | Yes | Yes | Yes | Yes | — | No | Pro |
+| **How you check** | Passage highlighted | Scrolls to source | Page citation, click to check | Inline citation, jumps to the quote | Link to file; says it highlights | Cited sources | Page number, click to jump |
 | **Free tier** | 500 starter, then 300/mo | 2 docs/day | 1 doc/day | 100 notebooks | 60 pages/mo | 1 upload/mo | 5 files/day |
 | **Paid from** | $9.99/mo | Not published | $11.99/mo | Google AI plans | $9.99/mo | $10/mo (yearly) | $8.99/30 days |
 | **No-signup demo** | Yes | — | — | — | — | — | — |
@@ -186,7 +186,7 @@ Checked 30 September 2026 on each vendor's own site unless noted.
 
 ## How to Choose
 
-- **You need to prove where an answer came from** (legal, financial, academic): DocTalk highlights the exact passage and gives machine-checked quotes with the page.
+- **You need to prove where an answer came from** (legal, financial, academic): DocTalk highlights the cited passage and gives machine-checked quotes with the page.
 - **You work across Word, PowerPoint and Excel:** DocTalk reads all three; ChatPDF and Gemini Notebook read Word and PowerPoint but not .xlsx.
 - **You want free:** Gemini Notebook has the largest free allowance. DocTalk has a [no-signup demo](/demo) and a monthly free allowance.
 - **You manage papers in Zotero:** AskYourPDF.
@@ -198,7 +198,7 @@ Checked 30 September 2026 on each vendor's own site unless noted.
 
 There is a real difference between "see page 12", a link to the file, and a highlight on the exact passage the answer used. With a page number you still scan the page; with a highlighted passage you read a few lines and decide. If you ask many questions about documents where accuracy matters — contracts, filings, papers — that difference adds up.
 
-The strongest tools here each take a different route: DocTalk highlights the cited passage and checks quotes against the source, ChatPDF scrolls to the source in a side-by-side view, and ChatDOC links individual data points.
+The strongest tools here each take a different route: DocTalk highlights the cited passage and checks quotes against the source, ChatPDF scrolls to the source in a side-by-side view, and ChatDOC puts page numbers on every answer that jump to the source when you click them.
 
 ## Pricing Reality Check
 
diff --git a/frontend/content/blog/chatpdf-alternatives-2026.md b/frontend/content/blog/chatpdf-alternatives-2026.md
index 8190e208..fc8217d7 100644
--- a/frontend/content/blog/chatpdf-alternatives-2026.md
+++ b/frontend/content/blog/chatpdf-alternatives-2026.md
@@ -2,7 +2,7 @@
 title: "7 Best ChatPDF Alternatives in 2026 (Free and Paid)"
 description: "ChatPDF alternatives compared on formats, citations and current pricing: DocTalk, AskYourPDF, PDF.ai, Humata, Gemini Notebook (formerly NotebookLM), Consensus and Claude. Prices checked 30 September 2026."
 date: "2026-03-18"
-updated: "2026-10-10"
+updated: "2026-10-14"
 author: "DocTalk Team"
 category: "comparisons"
 tags: ["chatpdf", "comparison", "alternatives", "ai tools", "pdf", "document chat"]
@@ -22,7 +22,7 @@ keywords: ["chatpdf alternative", "chatpdf alternatives 2026", "best chatpdf alt
 
 ChatPDF introduced millions of people to a simple idea in 2023: upload a PDF, ask questions, get answers. It is still a good tool for that. This guide compares seven alternatives on the things that decide daily use — which files they read, how you check an answer, the free tier, and what you pay.
 
-**How we compiled this:** every price and limit below comes from the vendor's own pricing or help page, read on 30 September 2026, unless we say otherwise. Plans change often, so check the vendor's page before you buy.
+**How we compiled this:** every price and limit below comes from the vendor's own pricing or help page, read on 30 September 2026, unless we say otherwise; formats and citation features were checked again on 10 October 2026. Plans change often, so check the vendor's page before you buy.
 
 ## Why People Look for ChatPDF Alternatives
 
@@ -40,7 +40,7 @@ If you only need quick answers from a few files a day, ChatPDF may still be the
 
 ### 1. DocTalk — Best for Answers You Can Verify, Across Formats
 
-[DocTalk](/) is an AI document Q&A tool for PDF, DOCX, PPTX, XLSX, TXT, Markdown and web URLs. Every answer carries numbered citations; click one and the document scrolls to the exact passage and [highlights it](/features/citations). For quotes you want to reuse, **Quote Finder** returns quotes taken from the source text and checked against it by machine before they are shown, with the page they come from.
+[DocTalk](/) is an AI document Q&A tool for PDF, DOCX, PPTX, XLSX, TXT, Markdown and web URLs. Every answer carries numbered citations; click one and the document scrolls to the cited passage and [highlights it](/features/citations). For quotes you want to reuse, **Quote Finder** returns quotes taken from the source text and checked against it by machine before they are shown, with the page they come from.
 
 **What sets it apart:** citations you can click through to the highlighted passage, on seven formats, plus quotes that are checked against the document rather than paraphrased by the model.
 
@@ -64,18 +64,18 @@ If you only need quick answers from a few files a day, ChatPDF may still be the
 
 ### 2. AskYourPDF — Best for Research Integration
 
-[AskYourPDF](https://askyourpdf.com) began as a ChatGPT plugin and is now a standalone app and API; it is also reported to offer a Chrome extension and a Zotero integration.
+[AskYourPDF](https://askyourpdf.com) began as a ChatGPT plugin and is now a standalone app and API. It runs on the web, iOS and Android, and as a Chrome extension, a ChatGPT GPT and a Zotero plugin.
 
-**What sets it apart:** very large page allowances on paid plans and, per third-party reviews, a Zotero integration for researchers.
+**What sets it apart:** very large page allowances on paid plans and a Zotero plugin for researchers.
 
 **Pros:**
-- Zotero integration and Chrome extension (per third-party reviews)
+- Zotero plugin and Chrome extension
 - Developer API
 - Very large page allowances on paid plans (2,500 pages per document on Premium, 6,000 on Pro)
 
 **Cons:**
 - Tight free plan: 1 document a day, up to 100 pages and 15 MB, 50 questions a day
-- References are page-level text citations rather than highlighted passages (per third-party reviews)
+- Each answer cites the page it came from and you click the citation to check it; AskYourPDF does not say it highlights the passage
 
 **Pricing:** Free (limits above). Premium: $11.99/month. Pro: $14.99/month. Enterprise: custom.
 
@@ -94,8 +94,8 @@ If you only need quick answers from a few files a day, ChatPDF may still be the
 
 **Cons:**
 - Free plan is small: 1 upload and 100 questions a month, 10 MB files
-- Chats with PDFs; third-party reviews report no native Word or PowerPoint chat
-- References are text-based rather than highlighted passages (per third-party reviews)
+- PDF only: "You can only upload PDF (.pdf) files at the moment" (PDF.ai FAQ)
+- Answers come "with cited sources" (PDF.ai FAQ); PDF.ai does not say it highlights the passage
 
 **Pricing:** Hobby: free. Pro: $17/month, or $10/month billed yearly. Ultimate: $27/month, or $20/month yearly. Enterprise: $37 per user per month, or $30 yearly.
 
@@ -114,7 +114,7 @@ If you only need quick answers from a few files a day, ChatPDF may still be the
 
 **Cons:**
 - Free plan covers 60 pages a month
-- Citations link to the file; we could not confirm passage-level highlighting
+- Citations link to the file; Humata says it "highlights citations" but does not say what is highlighted or where
 
 **Pricing:** Free: 60 pages/month. Expert: $9.99/month (3 users, 500 pages/month). Team: $49 per user per month (5,000 pages/month). Enterprise: custom.
 
@@ -129,7 +129,7 @@ If you only need quick answers from a few files a day, ChatPDF may still be the
 **Pros:**
 - Free: up to 100 notebooks and 50 sources per notebook
 - Reads Word, PDF, PowerPoint, text, Markdown, CSV, Google Docs, Slides and Sheets, ePub, audio, images, web URLs and public YouTube videos
-- Inline citations grounded in your sources
+- Inline citations grounded in your sources; select one to jump to the quote
 - Audio overviews (podcast-style summaries)
 
 **Cons:**
@@ -187,16 +187,16 @@ People searching for "Chatty PDF" are often looking for ChatPDF, but [ChattyPDF]
 
 ## Comparison Table
 
-Prices and limits as published by each vendor, checked 30 September 2026.
+Prices and limits as published by each vendor, checked 30 September 2026; formats and citation features checked again 10 October 2026.
 
 | Tool | Reads | How you check an answer | Free tier | Paid from |
 |---|---|---|---|---|
 | **DocTalk** | PDF, DOCX, PPTX, XLSX, TXT, MD, URL | Click citation → passage highlighted; machine-checked quotes with page | 500 starter credits, then 300/mo | $9.99/mo |
 | **ChatPDF** | PDF, DOC/DOCX, PPT/PPTX, MD, TXT | Clickable citations that scroll to the source | 2 documents/day | Not published |
-| **AskYourPDF** | PDF-first | Page-level text references | 1 doc/day, 50 questions | $11.99/mo |
-| **PDF.ai** | PDF | Text references | 1 upload/mo, 100 questions | $10/mo (yearly) |
+| **AskYourPDF** | PDF, DOCX, EPUB, TXT, URL | Page citation, click to check | 1 doc/day, 50 questions | $11.99/mo |
+| **PDF.ai** | PDF | Cited sources | 1 upload/mo, 100 questions | $10/mo (yearly) |
 | **Humata** | Uploaded files | Links to cited source files | 60 pages/mo | $9.99/mo |
-| **Gemini Notebook** | Docs, PDF, PPTX, Sheets/CSV, web, YouTube, audio… | Inline source citations | 100 notebooks, 50 sources each | Google AI plans |
+| **Gemini Notebook** | Docs, PDF, PPTX, Sheets/CSV, web, YouTube, audio… | Inline citations; select one to jump to the quote | 100 notebooks, 50 sources each | Google AI plans |
 | **Consensus** | Published papers only | Links to papers | 10 Pro messages/mo | $20/mo |
 | **Claude** | PDF, text, images, code… | Conversational references | Usage-limited | $17/mo (yearly) |
 
```
