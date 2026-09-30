# Codex fact-check round 3 — confirm

Round 2 is in .collab/reviews/2026-10-01-listicle-refresh/codex-r2-output.md. Do NOT run git. Confirm items 2 and 3 and the three NEW problems are FIXED (file:line), list any new real problem in the changed lines, final line SHIP / SHIP-WITH-FIXES / REWORK. Be brief.

```diff
diff --git a/frontend/content/blog/best-ai-pdf-tools-2026.md b/frontend/content/blog/best-ai-pdf-tools-2026.md
index 851d0100..8ff9cf8d 100644
--- a/frontend/content/blog/best-ai-pdf-tools-2026.md
+++ b/frontend/content/blog/best-ai-pdf-tools-2026.md
@@ -174,7 +174,7 @@ Checked 30 September 2026 on each vendor's own site unless noted.
 |---|---|---|---|---|---|---|---|
 | **PDF** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
 | **Word** | Yes | Yes | —¹ | Yes | —¹ | No¹ | Pro |
-| **PowerPoint** | Yes | Yes | —¹ | Yes | —¹ | No¹ | — |
+| **PowerPoint** | Yes | Yes | Yes¹ | Yes | —¹ | No¹ | — |
 | **Excel** | Yes | No | No | Sheets/CSV | —¹ | No | — |
 | **Web URL** | Yes | Yes | — | Yes | — | No | Pro |
 | **How you check** | Passage highlighted | Scrolls to source | Page reference¹ | Inline citation | Link to file | Text reference¹ | TapSource |
diff --git a/frontend/content/blog/best-ai-tools-academic-research-2026.md b/frontend/content/blog/best-ai-tools-academic-research-2026.md
index 3ee64586..420e3f07 100644
--- a/frontend/content/blog/best-ai-tools-academic-research-2026.md
+++ b/frontend/content/blog/best-ai-tools-academic-research-2026.md
@@ -276,9 +276,9 @@ No single tool covers the full research lifecycle. Here is a practical workflow
 | **Connected Papers** | Literature search | No | 5 graphs/mo | From €4.16/mo (yearly) | Research mapping |
 | **Semantic Scholar** | Literature search | No | Unlimited | Free | Academic search |
 | **Zotero + AI** | Reference mgmt | Via plugins | Free (core) | Storage plans | Organized libraries |
-| **ScholarAI** | Paper search in ChatGPT | No | See site | See site | ChatGPT users |
+| **ScholarAI** | Paper search (ChatGPT era) | No | Not verified | Not verified | Check scholarai.io first |
 
-Prices from each vendor's site, checked 30 September 2026.
+Prices for DocTalk, Gemini Notebook, Claude, Consensus, Elicit and Connected Papers come from each vendor's site, checked 30 September 2026. The Semantic Scholar and Zotero rows are from our March review; ScholarAI's current offer is unverified.
 
 ## Honest Advice for Researchers
 
diff --git a/frontend/content/blog/how-to-chat-with-docx-ai.md b/frontend/content/blog/how-to-chat-with-docx-ai.md
index 2ae338bb..19c54813 100644
--- a/frontend/content/blog/how-to-chat-with-docx-ai.md
+++ b/frontend/content/blog/how-to-chat-with-docx-ai.md
@@ -1,8 +1,8 @@
 ---
 title: "How to Chat with Word Documents (DOCX) Using AI"
-description: "Most AI tools only support PDFs. Learn how DocTalk lets you chat with DOCX files, with full paragraph and table extraction and cited answers."
+description: "Many AI PDF tools still expect a PDF. Learn how DocTalk lets you chat with Word (DOCX) files, with paragraph and table extraction and cited answers you can click through to the passage."
 date: "2026-02-18"
-updated: "2026-02-18"
+updated: "2026-10-01"
 author: "DocTalk Team"
 category: "guides"
 tags: ["docx", "word", "ai chat", "tutorial", "multi-format"]
@@ -19,7 +19,7 @@ If you have been converting your DOCX files to PDF just to use an AI chat tool,
 
 Microsoft Word is the default document format for most businesses, law firms, government agencies, and academic institutions. The format is based on [Microsoft's OOXML specification](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-docx/). According to Microsoft, there are over 1 billion Office users worldwide, and Word remains the most-used application in the suite.
 
-Yet most AI PDF tools — including ChatPDF, AskYourPDF, and PDF.ai — require you to convert DOCX to PDF before uploading. This conversion step introduces several problems:
+Yet several AI PDF tools still expect a PDF — PDF.ai, for example, is PDF-focused according to third-party reviews — so Word files have to be converted before upload. That conversion step introduces several problems:
 
 - **Lost formatting**: Headers, footers, and complex layouts can shift during PDF conversion
 - **Table corruption**: Multi-column tables sometimes merge cells or lose alignment
@@ -118,16 +118,20 @@ DocTalk supports multiple chat sessions per document. If you are analyzing a 100
 
 ## Comparing DOCX Support Across AI Tools
 
-| Tool | Native DOCX | Table Support | Citation Quality |
+Checked 30 September 2026 on each vendor's own site unless marked.
+
+| Tool | Native DOCX | Table Support | How you check an answer |
 |---|---|---|---|
-| **DocTalk** | Yes | Full table extraction | Click-to-highlight |
-| ChatPDF | No (PDF only) | N/A | Page reference |
-| AskYourPDF | No (PDF only) | N/A | Page reference |
-| NotebookLM | No (Google Docs only) | N/A | Inline reference |
-| ChatDOC | Yes | Basic | Page reference |
-| PDF.ai | No (PDF only) | N/A | In-doc highlight |
-
-DocTalk and ChatDOC are the only major AI document tools with native DOCX support. DocTalk offers stronger citation highlighting (click-to-navigate with text highlighting vs. page references).
+| **DocTalk** | Yes | Full table extraction | Click a citation → passage highlighted |
+| ChatPDF | Yes (DOC/DOCX) | — | Clickable citations that scroll to the source |
+| AskYourPDF | Not listed¹ | — | Page-level text references¹ |
+| Gemini Notebook (formerly NotebookLM) | Yes (Word) | — | Inline source citations |
+| ChatDOC | Yes (Pro plan) | — | TapSource citations |
+| PDF.ai | No¹ (PDF-focused) | N/A | Text references¹ |
+
+¹ From third-party reviews. "—" means we could not confirm it.
+
+Word support is no longer rare: DocTalk, ChatPDF, Gemini Notebook and ChatDOC (on Pro) all read DOCX natively. DocTalk's difference is how you check the answer — click a citation and the passage is highlighted in the document.
 
 ## Frequently Asked Questions
 
```
