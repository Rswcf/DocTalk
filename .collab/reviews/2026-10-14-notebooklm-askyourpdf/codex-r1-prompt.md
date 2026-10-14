# Codex fact-check: AskYourPDF facts in notebooklm-alternatives-2026.md (DocTalk, 2026-10-14)

Do NOT run git. Repo root = cwd. The diff under review (base 2f2a9eaf → working tree) is pasted at the end.

## Why this post changed

`notebooklm-alternatives-2026.md` (not frozen) still said AskYourPDF's Zotero and Chrome integrations were "per
third-party reviews". The owner asked to replace that label with vendor-sourced wording, check the rest of the
AskYourPDF section against vendor evidence, and set `updated` to the ship date (2026-10-14). Scope: AskYourPDF only.
Frozen, must not be touched: `best-ai-tools-academic-research-2026.md`, `ai-pdf-readers-page-number-citations-2026.md`.

## The evidence changed during the work — read this first

The brief's source of record was `.collab/reviews/2026-10-10-step5-page-citations/vendor-evidence.md` §2.6, which read
only `/chat-with-pdf` and the static pricing HTML. A first draft built on §2.6 was fact-checked by an Opus reviewer
(Codex was down) and got REWORK (`opus-r1-output.md` in this directory): AskYourPDF's other pages say more. The
executor re-checked those findings against the saved pages. Source of record now:
`.collab/reviews/2026-10-14-notebooklm-askyourpdf/evidence.md` (quotes ≤25 words, read 2026-10-14). In short:
- Formats: `/chat-with-pdf` lists PDF, DOCX, EPUB, TXT + "paste a URL"; `/pdf-ai` and `/chat-with-documents` list
  PDF, DOCX, EPUB, PPTX, RTF, TXT, CSV. The vendor disagrees with itself. No page mentions XLSX or Excel.
- Citations: `/pdf-ai` "citation to the exact paragraph or page … Click the citation to jump straight to the source"
  and "with the source paragraph or page highlighted so you can verify the response yourself".
- Prices: yearly-billed Premium $11.99 / Pro $14.99 per month; monthly-billed Premium $14.99 / Pro $19.99 (page JS
  `month:{…premium:"14.99",pro:"19.99"…}`, rendered "billed monthly" when the toggle is off).
- Apps: "Web, iOS, Android, Chrome extension, ChatGPT GPT, and the Zotero plugin".
Your sandbox may have no network; if it has, you may re-read those vendor URLs read-only.

Do NOT treat `frontend/src/i18n/locales/*.json` (`compareAskyourpdf.*`, `altsAskyourpdf.*`, `altsHumata.alt3Desc2`) or
the two posts shipped today (`best-ai-pdf-tools-2026.md`, `chatpdf-alternatives-2026.md`) as support: they inherit
the same §2.6 gap (they say PowerPoint "—", "does not say it highlights", "monthly-billed price is not shown").
Fixing them is a separate, owner-decided follow-up and is NOT in this diff. This post will disagree with them.

## Executor decisions for you to check

1. Formats sentence (:87) names both vendor pages and picks no side (pattern: ChatDOC's self-contradiction in
   best-ai-pdf-tools-2026.md). "Built around PDFs" kept: `/pdf-ai` says it handles other formats "in case you ever need
   to ask questions outside of PDF format".
2. Table: Word / PowerPoint "Yes / Yes", no ¹ (a page listing fewer formats is not a "No"); Excel "CSV" (parallels the
   Gemini cell "Sheets or CSV"; no XLSX anywhere); How you check "Paragraph or page cited; vendor says a click jumps
   there and highlights it" (vendor-evidence Method: "the vendor says", never "shows"; DocTalk's cell is product truth).
3. Key-differences bullet (:91) states the citation claim as AskYourPDF's own.
4. Pricing (:95) mirrors this post's PDF.ai sentence; table "Paid from $11.99/mo (yearly)".
5. Check dates (:21, :131) say 14 October 2026 and add "prices" (the corrected facts come from the 10-14 re-read).
6. Left unchanged on purpose: title, description, headings ("AskYourPDF — Best for Large PDFs"), tool order, Short
   answer (:14), the FAQ "Which NotebookLM alternative shows the source passage in the original document?" (names
   DocTalk and ChatPDF, does not say "only"), and the PDF.ai / Humata / Gemini cells (out of scope; their
   vendor-sourced upgrades are logged as follow-ups). Tell me if any of these is now false, or unfair to AskYourPDF
   given its highlight claim.

## Check, adversarially

1. Every changed sentence and cell against evidence.md. Flag wording stronger or weaker than the vendor's, and any
   claim not in evidence.md.
2. Unchanged neighbours in this post that the change now contradicts (grep AskYourPDF, "third-party", "large PDFs",
   "thousands of pages", "highlight", "$11.99", "$14.99", "$19.99").
3. Fairness: neither disparage AskYourPDF beyond its own words nor overstate it as tested behaviour.
4. Markdown: 7-column table rows, footnote ¹ still referenced only by third-party cells, frontmatter `updated`,
   `frontend/tests/blog-jsonld.test.cjs` still finds 5 ranked items (headings unchanged).

Output numbered findings with severity (BLOCKER / SHOULD / NIT), file:line, and a concrete fix.
Final line: SHIP / SHIP-WITH-FIXES / REWORK.

## The diff

```diff
diff --git a/frontend/content/blog/notebooklm-alternatives-2026.md b/frontend/content/blog/notebooklm-alternatives-2026.md
index fce44485..f781d848 100644
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
+**How we compiled this:** prices, limits and supported formats come from each vendor's own pricing and help pages, read on 30 September 2026; AskYourPDF's prices, formats and citation features were checked again on 14 October 2026. Where we relied on third-party reviews, we say so. Plans change often, so check before you buy.
 
 ## What Gemini Notebook (NotebookLM) Does Well
 
@@ -82,16 +82,17 @@ Any replacement should match these strengths, or have a good reason not to:
 
 ### 3. AskYourPDF — Best for Large PDFs
 
-[AskYourPDF](https://askyourpdf.com) began as a ChatGPT plugin and is now a standalone app and API; it is also reported to offer a Chrome extension and a Zotero integration.
+[AskYourPDF](https://askyourpdf.com) began as a ChatGPT plugin and is now a standalone app and API. It runs on the web, iOS and Android, and as a Chrome extension, a ChatGPT GPT and a Zotero plugin.
 
-**How it compares to Gemini Notebook:** built around PDFs, with very large page allowances on paid plans (2,500 pages per document on Premium, 6,000 on Pro).
+**How it compares to Gemini Notebook:** built around PDFs, with very large page allowances on paid plans (2,500 pages per document on Premium, 6,000 on Pro). AskYourPDF's own pages disagree on other formats: its PDF AI and document-chat pages list DOCX, EPUB, PPTX, RTF, TXT and CSV files, while its chat-with-PDF page lists DOCX, EPUB and TXT files or a pasted URL.
 
 **Key differences:**
 - Very large per-document page limits on paid plans
-- Developer API; Zotero and Chrome integrations per third-party reviews
+- AskYourPDF says each answer cites "the exact paragraph or page", that clicking the citation jumps to the source, and that the source is highlighted
+- Developer API; Zotero plugin and Chrome extension
 - Tight free plan: 1 document a day (100 pages, 15 MB), 50 questions a day
 
-**Pricing:** Free (limits above). Premium: $11.99/month. Pro: $14.99/month. Enterprise: custom. See [DocTalk vs AskYourPDF](/compare/askyourpdf).
+**Pricing:** Free (limits above). Premium: $14.99/month, or $11.99/month billed yearly. Pro: $19.99/month, or $14.99/month billed yearly. Enterprise: custom. See [DocTalk vs AskYourPDF](/compare/askyourpdf).
 
 **Best for:** researchers with long PDFs.
 
@@ -127,15 +128,15 @@ Any replacement should match these strengths, or have a good reason not to:
 
 ## Comparison Table
 
-Checked 30 September 2026 on each vendor's own site unless marked.
+Checked 30 September 2026 on each vendor's own site unless marked; AskYourPDF's prices, formats and citation features checked again 14 October 2026.
 
 | Feature | Gemini Notebook | DocTalk | ChatPDF | AskYourPDF | Humata | PDF.ai |
 |---|---|---|---|---|---|---|
 | **Free tier** | 100 notebooks, 50 sources each | 500 starter, then 300 credits/mo | 2 docs/day | 1 doc/day | 60 pages/mo | 1 upload/mo |
-| **Paid from** | Google AI plans | $9.99/mo | Not published | $11.99/mo | $9.99/mo | $10/mo (yearly) |
-| **Word / PowerPoint** | Yes / Yes | Yes / Yes | Yes / Yes | —¹ / Yes¹ | —¹ | No¹ |
-| **Excel** | Sheets or CSV | Native .xlsx | No | No | —¹ | No |
-| **How you check an answer** | Inline citation | Passage highlighted in the file | Scrolls to source | Page-level reference¹ | Link to file | Text reference¹ |
+| **Paid from** | Google AI plans | $9.99/mo | Not published | $11.99/mo (yearly) | $9.99/mo | $10/mo (yearly) |
+| **Word / PowerPoint** | Yes / Yes | Yes / Yes | Yes / Yes | Yes / Yes | —¹ | No¹ |
+| **Excel** | Sheets or CSV | Native .xlsx | No | CSV | —¹ | No |
+| **How you check an answer** | Inline citation | Passage highlighted in the file | Scrolls to source | Paragraph or page cited; vendor says a click jumps there and highlights it | Link to file | Text reference¹ |
 | **Audio overviews** | Yes | No | No | No | No | No |
 | **Google account needed** | Yes | No | No | No | No | No |
 
```
